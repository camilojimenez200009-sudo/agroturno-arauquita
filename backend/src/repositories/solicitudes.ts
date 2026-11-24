import type { Consultor } from '../db/pool';
import type { UsuarioSesion } from '../services/sesiones';

export type Estado = 'PENDIENTE' | 'PROGRAMADA' | 'EN_PROCESO' | 'COMPLETADA';
export const ESTADOS: Estado[] = ['PENDIENTE', 'PROGRAMADA', 'EN_PROCESO', 'COMPLETADA'];

export interface FiltrosSolicitudes {
  estado?: Estado[];
  producto_id?: string;
  desde?: string;
  hasta?: string;
  q?: string;
  pagina: number;
  tamano: number;
  orden: 'recientes' | 'fecha_disponible' | 'fecha_programada';
}

export interface FilaSolicitud {
  id: string;
  codigo: string;
  estado: Estado;
  producto_id: string;
  producto_nombre: string;
  cantidad: number;
  unidad: string;
  ubicacion_texto: string;
  latitud: number | null;
  longitud: number | null;
  fecha_disponible: string;
  notas: string | null;
  productor_id: string;
  productor_nombre: string;
  productor_vereda: string;
  productor_telefono: string | null;
  productor_usuario_id: string | null;
  creado_por_nombre: string;
  creada_en: string;
  actualizada_en: string;
  programacion_id: string | null;
  fecha_programada: string | null;
  franja: string | null;
  coordinador_nombre: string | null;
  programacion_actualizada_en: string | null;
  transporte_nombre: string | null;
  transporte_telefono: string | null;
  transporte_vehiculo: string | null;
  transporte_observaciones: string | null;
}

const SELECT_BASE = `
  SELECT s.id, s.codigo, s.estado, s.producto_id, pr.nombre AS producto_nombre,
         s.cantidad, s.unidad, s.ubicacion_texto, s.latitud, s.longitud, s.fecha_disponible, s.notas,
         s.productor_id, pd.nombre_publico AS productor_nombre, pd.vereda AS productor_vereda,
         pd.telefono AS productor_telefono, pd.usuario_id AS productor_usuario_id,
         creador.nombre AS creado_por_nombre, s.creada_en, s.actualizada_en,
         pg.id AS programacion_id, pg.fecha_programada, pg.franja, coord.nombre AS coordinador_nombre,
         pg.actualizada_en AS programacion_actualizada_en,
         t.nombre_contacto AS transporte_nombre, t.telefono AS transporte_telefono,
         t.tipo_vehiculo AS transporte_vehiculo, t.observaciones AS transporte_observaciones
    FROM solicitudes s
    JOIN productos pr ON pr.id = s.producto_id
    JOIN productores pd ON pd.id = s.productor_id
    JOIN usuarios creador ON creador.id = s.creado_por
    LEFT JOIN programaciones pg ON pg.solicitud_id = s.id
    LEFT JOIN usuarios coord ON coord.id = pg.coordinador_id
    LEFT JOIN transportes t ON t.programacion_id = pg.id`;

/** Condición de autorización: el productor solo ve lo propio (RN-08) */
function alcance(usuario: UsuarioSesion, valores: unknown[]): string | null {
  if (usuario.rol === 'PRODUCTOR') {
    valores.push(usuario.productorId);
    return `s.productor_id = $${valores.length}`;
  }
  return null;
}

export async function listar(db: Consultor, usuario: UsuarioSesion, filtros: FiltrosSolicitudes) {
  const valores: unknown[] = [];
  const condiciones: string[] = [];
  const restriccion = alcance(usuario, valores);
  if (restriccion) condiciones.push(restriccion);

  if (filtros.estado?.length) {
    valores.push(filtros.estado);
    condiciones.push(`s.estado = ANY($${valores.length})`);
  }
  if (filtros.producto_id) {
    valores.push(filtros.producto_id);
    condiciones.push(`s.producto_id = $${valores.length}`);
  }
  if (filtros.desde) {
    valores.push(filtros.desde);
    condiciones.push(`s.fecha_disponible >= $${valores.length}`);
  }
  if (filtros.hasta) {
    valores.push(filtros.hasta);
    condiciones.push(`s.fecha_disponible <= $${valores.length}`);
  }
  if (filtros.q) {
    valores.push(`%${filtros.q}%`);
    const i = valores.length;
    condiciones.push(
      usuario.rol === 'PRODUCTOR'
        ? `s.codigo ILIKE $${i}`
        : `(s.codigo ILIKE $${i} OR pd.nombre_publico ILIKE $${i} OR pd.vereda ILIKE $${i})`,
    );
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const orden = {
    recientes: 's.consecutivo DESC',
    fecha_disponible: 's.fecha_disponible ASC, s.consecutivo ASC',
    fecha_programada: 'pg.fecha_programada ASC NULLS LAST, s.fecha_disponible ASC',
  }[filtros.orden];

  const total = await db.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM solicitudes s JOIN productores pd ON pd.id = s.productor_id
       LEFT JOIN programaciones pg ON pg.solicitud_id = s.id ${where}`,
    valores,
  );
  valores.push(filtros.tamano, (filtros.pagina - 1) * filtros.tamano);
  const { rows } = await db.query<FilaSolicitud>(
    `${SELECT_BASE} ${where} ORDER BY ${orden} LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
    valores,
  );
  return { filas: rows, total: total.rows[0].total };
}

export async function resumen(db: Consultor, usuario: UsuarioSesion) {
  const valores: unknown[] = [];
  const restriccion = alcance(usuario, valores);
  const { rows } = await db.query<{ estado: Estado; total: number }>(
    `SELECT s.estado, count(*)::int AS total FROM solicitudes s
      ${restriccion ? `WHERE ${restriccion}` : ''} GROUP BY s.estado`,
    valores,
  );
  const conteos: Record<Estado, number> = { PENDIENTE: 0, PROGRAMADA: 0, EN_PROCESO: 0, COMPLETADA: 0 };
  for (const fila of rows) conteos[fila.estado] = fila.total;
  return conteos;
}

/** Busca una solicitud visible para el usuario. Devuelve null si no existe o no le pertenece. */
export async function obtener(db: Consultor, usuario: UsuarioSesion, id: string): Promise<FilaSolicitud | null> {
  const valores: unknown[] = [id];
  const restriccion = alcance(usuario, valores);
  const { rows } = await db.query<FilaSolicitud>(
    `${SELECT_BASE} WHERE s.id = $1 ${restriccion ? `AND ${restriccion}` : ''}`,
    valores,
  );
  return rows[0] ?? null;
}

/** Bloquea la fila para operaciones de escritura dentro de una transacción */
export async function bloquear(db: Consultor, usuario: UsuarioSesion, id: string) {
  const valores: unknown[] = [id];
  const restriccion = alcance(usuario, valores);
  const { rows } = await db.query<{
    id: string;
    estado: Estado;
    productor_id: string;
    producto_id: string;
    cantidad: number;
    unidad: string;
    ubicacion_texto: string;
    latitud: number | null;
    longitud: number | null;
    fecha_disponible: string;
    notas: string | null;
  }>(
    `SELECT s.id, s.estado, s.productor_id, s.producto_id, s.cantidad, s.unidad, s.ubicacion_texto,
            s.latitud, s.longitud, s.fecha_disponible, s.notas
       FROM solicitudes s WHERE s.id = $1 ${restriccion ? `AND ${restriccion}` : ''} FOR UPDATE`,
    valores,
  );
  return rows[0] ?? null;
}

export async function registrarHistorial(
  db: Consultor,
  evento: {
    solicitud_id: string;
    usuario_id: string;
    accion: 'CREACION' | 'EDICION' | 'PROGRAMACION' | 'REPROGRAMACION' | 'TRANSPORTE' | 'CAMBIO_ESTADO';
    estado_anterior?: Estado | null;
    estado_nuevo?: Estado | null;
    detalle?: Record<string, unknown>;
    motivo?: string | null;
  },
) {
  await db.query(
    `INSERT INTO historial_solicitudes (solicitud_id, usuario_id, accion, estado_anterior, estado_nuevo, detalle, motivo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      evento.solicitud_id,
      evento.usuario_id,
      evento.accion,
      evento.estado_anterior ?? null,
      evento.estado_nuevo ?? null,
      evento.detalle ?? {},
      evento.motivo ?? null,
    ],
  );
}

export async function historial(db: Consultor, solicitudId: string) {
  const { rows } = await db.query(
    `SELECT h.id, h.accion, h.estado_anterior, h.estado_nuevo, h.detalle, h.motivo, h.creado_en,
            u.nombre AS usuario_nombre, u.rol AS usuario_rol
       FROM historial_solicitudes h JOIN usuarios u ON u.id = h.usuario_id
      WHERE h.solicitud_id = $1 ORDER BY h.id ASC`,
    [solicitudId],
  );
  return rows;
}
