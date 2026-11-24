import { transaccion, type Consultor } from '../db/pool';
import * as repo from '../repositories/solicitudes';
import type { Estado, FilaSolicitud } from '../repositories/solicitudes';
import { conflicto, ErrorHttp, invalido, noEncontrado, prohibido } from '../utils/errores';
import { hoyEnBogota, sumarDias } from '../utils/fechas';
import type { UsuarioSesion } from './sesiones';

export const MAX_DIAS_ADELANTE = 180;

/** Única secuencia permitida por el contrato de estados (sin retrocesos) */
export const SIGUIENTE_ESTADO: Partial<Record<Estado, Estado>> = {
  PROGRAMADA: 'EN_PROCESO',
  EN_PROCESO: 'COMPLETADA',
};

export interface DatosSolicitud {
  producto_id: string;
  cantidad: number;
  unidad: string;
  ubicacion_texto: string;
  latitud?: number | null;
  longitud?: number | null;
  fecha_disponible: string;
  notas?: string | null;
}

export interface DatosProgramacion {
  fecha_programada: string;
  franja: 'MANANA' | 'TARDE' | 'JORNADA_COMPLETA';
  motivo?: string | null;
  transporte?: {
    nombre_contacto: string;
    telefono?: string | null;
    tipo_vehiculo?: string | null;
    observaciones?: string | null;
  } | null;
}

const esGestor = (u: UsuarioSesion) => u.rol === 'COORDINADOR' || u.rol === 'ADMINISTRADOR';

function permisos(fila: Pick<FilaSolicitud, 'estado' | 'productor_id'>, usuario: UsuarioSesion) {
  const propia = usuario.rol === 'PRODUCTOR' && usuario.productorId === fila.productor_id;
  const gestor = esGestor(usuario);
  return {
    editar: (propia && fila.estado === 'PENDIENTE') || (gestor && ['PENDIENTE', 'PROGRAMADA'].includes(fila.estado)),
    programar: gestor && ['PENDIENTE', 'PROGRAMADA'].includes(fila.estado),
    siguiente_estado: gestor ? (SIGUIENTE_ESTADO[fila.estado] ?? null) : null,
  };
}

/** Respuesta pública: los teléfonos solo se entregan a coordinación y administración (RN-08) */
export function serializar(fila: FilaSolicitud, usuario: UsuarioSesion) {
  const gestor = esGestor(usuario);
  return {
    id: fila.id,
    codigo: fila.codigo,
    estado: fila.estado,
    producto: { id: fila.producto_id, nombre: fila.producto_nombre },
    cantidad: fila.cantidad,
    unidad: fila.unidad,
    ubicacion_texto: fila.ubicacion_texto,
    latitud: fila.latitud,
    longitud: fila.longitud,
    fecha_disponible: fila.fecha_disponible,
    notas: fila.notas,
    productor: {
      id: fila.productor_id,
      nombre: fila.productor_nombre,
      vereda: fila.productor_vereda,
      ...(gestor ? { telefono: fila.productor_telefono } : {}),
    },
    creado_por: fila.creado_por_nombre,
    creada_en: fila.creada_en,
    actualizada_en: fila.actualizada_en,
    programacion: fila.programacion_id
      ? {
          fecha_programada: fila.fecha_programada,
          franja: fila.franja,
          coordinador: fila.coordinador_nombre,
          actualizada_en: fila.programacion_actualizada_en,
          transporte: fila.transporte_nombre
            ? {
                nombre_contacto: fila.transporte_nombre,
                tipo_vehiculo: fila.transporte_vehiculo,
                observaciones: fila.transporte_observaciones,
                ...(gestor ? { telefono: fila.transporte_telefono } : {}),
              }
            : null,
        }
      : null,
    permisos: permisos(fila, usuario),
  };
}

function validarFechaDisponible(fecha: string) {
  const hoy = hoyEnBogota();
  if (fecha < hoy) {
    throw invalido('Revisa la fecha disponible.', { fecha_disponible: 'La fecha disponible no puede estar en el pasado.' });
  }
  if (fecha > sumarDias(hoy, MAX_DIAS_ADELANTE)) {
    throw invalido('Revisa la fecha disponible.', {
      fecha_disponible: `Registra solicitudes con máximo ${MAX_DIAS_ADELANTE} días de anticipación.`,
    });
  }
}

async function validarProductoYUnidad(db: Consultor, productoId: string, unidad: string) {
  const { rows } = await db.query<{ activo: boolean; unidades: string[] }>(
    'SELECT activo, unidades FROM productos WHERE id = $1',
    [productoId],
  );
  const producto = rows[0];
  if (!producto || !producto.activo) {
    throw invalido('Revisa los campos marcados.', { producto_id: 'Selecciona un producto activo del catálogo.' });
  }
  if (!producto.unidades.includes(unidad)) {
    throw invalido('Revisa los campos marcados.', {
      unidad: `Unidad no válida para este producto. Usa: ${producto.unidades.join(', ')}.`,
    });
  }
}

async function detalle(db: Consultor, usuario: UsuarioSesion, id: string) {
  const fila = await repo.obtener(db, usuario, id);
  if (!fila) throw noEncontrado('La solicitud no existe o no tienes acceso a ella.');
  return serializar(fila, usuario);
}

// ---------------------------------------------------------------- RF-05
export async function crear(usuario: UsuarioSesion, datos: DatosSolicitud) {
  if (usuario.rol !== 'PRODUCTOR') throw prohibido('Solo una cuenta de productor puede registrar solicitudes.');
  if (!usuario.productorId) {
    throw new ErrorHttp(409, 'SIN_PERFIL', 'Tu cuenta no tiene perfil de productor. Comunícate con el administrador.');
  }
  validarFechaDisponible(datos.fecha_disponible);

  return transaccion(async (db) => {
    await validarProductoYUnidad(db, datos.producto_id, datos.unidad);
    const { rows } = await db.query<{ id: string; codigo: string }>(
      `INSERT INTO solicitudes (productor_id, producto_id, cantidad, unidad, ubicacion_texto,
                                latitud, longitud, fecha_disponible, notas, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, codigo`,
      [
        usuario.productorId,
        datos.producto_id,
        datos.cantidad,
        datos.unidad,
        datos.ubicacion_texto,
        datos.latitud ?? null,
        datos.longitud ?? null,
        datos.fecha_disponible,
        datos.notas ?? null,
        usuario.id,
      ],
    );
    await repo.registrarHistorial(db, {
      solicitud_id: rows[0].id,
      usuario_id: usuario.id,
      accion: 'CREACION',
      estado_nuevo: 'PENDIENTE',
      detalle: { cantidad: datos.cantidad, unidad: datos.unidad, fecha_disponible: datos.fecha_disponible },
    });
    return detalle(db, usuario, rows[0].id);
  });
}

// ---------------------------------------------------------------- RF-07
const CAMPOS_EDITABLES = [
  'producto_id',
  'cantidad',
  'unidad',
  'ubicacion_texto',
  'latitud',
  'longitud',
  'fecha_disponible',
  'notas',
] as const;

export async function editar(
  usuario: UsuarioSesion,
  id: string,
  cambios: Partial<DatosSolicitud> & { motivo?: string | null },
) {
  return transaccion(async (db) => {
    const actual = await repo.bloquear(db, usuario, id);
    if (!actual) throw noEncontrado('La solicitud no existe o no tienes acceso a ella.');
    const puede = permisos(actual, usuario);
    if (!puede.editar) {
      throw usuario.rol === 'PRODUCTOR'
        ? conflicto('Solo puedes editar tus solicitudes mientras están pendientes.')
        : conflicto('Las solicitudes en proceso o completadas no se editan.');
    }

    const nuevo = { ...actual, ...Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined)) };
    const diferencias: Record<string, { antes: unknown; despues: unknown }> = {};
    for (const campo of CAMPOS_EDITABLES) {
      const antes = actual[campo] ?? null;
      const despues = (nuevo as Record<string, unknown>)[campo] ?? null;
      if (String(antes) !== String(despues)) diferencias[campo] = { antes, despues };
    }
    if (Object.keys(diferencias).length === 0) {
      throw new ErrorHttp(400, 'SIN_CAMBIOS', 'No hay cambios para guardar.');
    }
    if ((nuevo.latitud == null) !== (nuevo.longitud == null)) {
      throw invalido('Revisa la ubicación.', { latitud: 'Las coordenadas deben incluir latitud y longitud.' });
    }
    if (diferencias.fecha_disponible) validarFechaDisponible(nuevo.fecha_disponible);
    if (diferencias.producto_id || diferencias.unidad) {
      await validarProductoYUnidad(db, nuevo.producto_id, nuevo.unidad);
    }

    await db.query(
      `UPDATE solicitudes
          SET producto_id = $2, cantidad = $3, unidad = $4, ubicacion_texto = $5, latitud = $6,
              longitud = $7, fecha_disponible = $8, notas = $9, actualizada_en = now()
        WHERE id = $1`,
      [
        id,
        nuevo.producto_id,
        nuevo.cantidad,
        nuevo.unidad,
        nuevo.ubicacion_texto,
        nuevo.latitud ?? null,
        nuevo.longitud ?? null,
        nuevo.fecha_disponible,
        nuevo.notas ?? null,
      ],
    );
    await repo.registrarHistorial(db, {
      solicitud_id: id,
      usuario_id: usuario.id,
      accion: 'EDICION',
      estado_anterior: actual.estado,
      estado_nuevo: actual.estado,
      detalle: { cambios: diferencias },
      motivo: cambios.motivo ?? null,
    });
    return detalle(db, usuario, id);
  });
}

// ---------------------------------------------------------------- RF-09 y RF-10
export async function programar(usuario: UsuarioSesion, id: string, datos: DatosProgramacion) {
  if (!esGestor(usuario)) throw prohibido('Solo coordinación puede programar solicitudes.');
  const hoy = hoyEnBogota();
  if (datos.fecha_programada < hoy) {
    throw invalido('Revisa la fecha programada.', { fecha_programada: 'La fecha programada no puede estar en el pasado.' });
  }
  if (datos.fecha_programada > sumarDias(hoy, MAX_DIAS_ADELANTE)) {
    throw invalido('Revisa la fecha programada.', { fecha_programada: 'La fecha está demasiado lejos.' });
  }

  return transaccion(async (db) => {
    const actual = await repo.bloquear(db, usuario, id);
    if (!actual) throw noEncontrado('La solicitud no existe.');
    if (!['PENDIENTE', 'PROGRAMADA'].includes(actual.estado)) {
      throw conflicto('Solo se programan o reprograman solicitudes pendientes o programadas.');
    }
    if (datos.fecha_programada < actual.fecha_disponible) {
      throw invalido('Revisa la fecha programada.', {
        fecha_programada: 'La recolección no puede programarse antes de la fecha disponible del producto.',
      });
    }

    const previa = await db.query<{ id: string; fecha_programada: string; franja: string }>(
      'SELECT id, fecha_programada, franja FROM programaciones WHERE solicitud_id = $1',
      [id],
    );
    const programacionPrevia = previa.rows[0];
    let programacionId: string;

    if (!programacionPrevia) {
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO programaciones (solicitud_id, fecha_programada, franja, coordinador_id)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [id, datos.fecha_programada, datos.franja, usuario.id],
      );
      programacionId = rows[0].id;
      await db.query(`UPDATE solicitudes SET estado = 'PROGRAMADA', actualizada_en = now() WHERE id = $1`, [id]);
      await repo.registrarHistorial(db, {
        solicitud_id: id,
        usuario_id: usuario.id,
        accion: 'PROGRAMACION',
        estado_anterior: actual.estado,
        estado_nuevo: 'PROGRAMADA',
        detalle: { fecha_programada: datos.fecha_programada, franja: datos.franja },
        motivo: datos.motivo ?? null,
      });
    } else {
      programacionId = programacionPrevia.id;
      const cambioFecha =
        programacionPrevia.fecha_programada !== datos.fecha_programada || programacionPrevia.franja !== datos.franja;
      if (cambioFecha) {
        if (!datos.motivo || datos.motivo.trim().length < 5) {
          throw invalido('Indica el motivo de la reprogramación.', {
            motivo: 'Escribe el motivo de la reprogramación (mínimo 5 caracteres).',
          });
        }
        await db.query(
          `UPDATE programaciones SET fecha_programada = $2, franja = $3, coordinador_id = $4, actualizada_en = now()
            WHERE id = $1`,
          [programacionId, datos.fecha_programada, datos.franja, usuario.id],
        );
        await db.query('UPDATE solicitudes SET actualizada_en = now() WHERE id = $1', [id]);
        await repo.registrarHistorial(db, {
          solicitud_id: id,
          usuario_id: usuario.id,
          accion: 'REPROGRAMACION',
          estado_anterior: actual.estado,
          estado_nuevo: actual.estado,
          detalle: {
            antes: { fecha_programada: programacionPrevia.fecha_programada, franja: programacionPrevia.franja },
            despues: { fecha_programada: datos.fecha_programada, franja: datos.franja },
          },
          motivo: datos.motivo,
        });
      }
    }

    if (datos.transporte !== undefined) {
      const previoTransporte = await db.query(
        'SELECT nombre_contacto, telefono, tipo_vehiculo, observaciones FROM transportes WHERE programacion_id = $1',
        [programacionId],
      );
      const antes = previoTransporte.rows[0] ?? null;
      const despues = datos.transporte
        ? {
            nombre_contacto: datos.transporte.nombre_contacto,
            telefono: datos.transporte.telefono ?? null,
            tipo_vehiculo: datos.transporte.tipo_vehiculo ?? null,
            observaciones: datos.transporte.observaciones ?? null,
          }
        : null;
      if (JSON.stringify(antes) !== JSON.stringify(despues)) {
        if (despues) {
          await db.query(
            `INSERT INTO transportes (programacion_id, nombre_contacto, telefono, tipo_vehiculo, observaciones)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (programacion_id) DO UPDATE
               SET nombre_contacto = EXCLUDED.nombre_contacto, telefono = EXCLUDED.telefono,
                   tipo_vehiculo = EXCLUDED.tipo_vehiculo, observaciones = EXCLUDED.observaciones,
                   actualizado_en = now()`,
            [programacionId, despues.nombre_contacto, despues.telefono, despues.tipo_vehiculo, despues.observaciones],
          );
        } else {
          await db.query('DELETE FROM transportes WHERE programacion_id = $1', [programacionId]);
        }
        // El historial no guarda teléfonos: solo qué cambió
        await repo.registrarHistorial(db, {
          solicitud_id: id,
          usuario_id: usuario.id,
          accion: 'TRANSPORTE',
          estado_anterior: null,
          estado_nuevo: null,
          detalle: {
            contacto: despues?.nombre_contacto ?? null,
            tipo_vehiculo: despues?.tipo_vehiculo ?? null,
            accion: !antes ? 'asociado' : despues ? 'actualizado' : 'retirado',
          },
        });
      }
    }
    return detalle(db, usuario, id);
  });
}

// ---------------------------------------------------------------- RF-11
export async function cambiarEstado(usuario: UsuarioSesion, id: string, estado: Estado, motivo?: string | null) {
  if (!esGestor(usuario)) throw prohibido('Solo coordinación puede cambiar el estado de una solicitud.');
  return transaccion(async (db) => {
    const actual = await repo.bloquear(db, usuario, id);
    if (!actual) throw noEncontrado('La solicitud no existe.');
    if (actual.estado === 'PENDIENTE' && estado === 'PROGRAMADA') {
      throw conflicto('Para pasar a Programada registra la programación con fecha y franja.');
    }
    if (SIGUIENTE_ESTADO[actual.estado] !== estado) {
      throw new ErrorHttp(
        409,
        'TRANSICION_INVALIDA',
        `No se puede pasar de ${actual.estado} a ${estado}. Secuencia permitida: Pendiente → Programada → En proceso → Completada.`,
      );
    }
    await db.query('UPDATE solicitudes SET estado = $2, actualizada_en = now() WHERE id = $1', [id, estado]);
    await repo.registrarHistorial(db, {
      solicitud_id: id,
      usuario_id: usuario.id,
      accion: 'CAMBIO_ESTADO',
      estado_anterior: actual.estado,
      estado_nuevo: estado,
      motivo: motivo ?? null,
    });
    return detalle(db, usuario, id);
  });
}
