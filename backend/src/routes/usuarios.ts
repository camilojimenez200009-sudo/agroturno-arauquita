import { Router } from 'express';
import { z } from 'zod';
import { consulta, transaccion } from '../db/pool';
import { requiereRol, requiereSesion, usuarioActual } from '../middleware/auth';
import { hashContrasena, revocarSesionesDeUsuario } from '../services/sesiones';
import { conflicto, invalido, noEncontrado } from '../utils/errores';
import { esquemaTelefono } from './productores';

export const rutasUsuarios = Router();
rutasUsuarios.use(requiereSesion, requiereRol('ADMINISTRADOR'));

const contrasena = z
  .string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres.')
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Combina letras y números.');

const esquemaAlta = z
  .object({
    nombre: z.string().trim().min(3, 'Mínimo 3 caracteres.').max(120),
    correo: z.string().trim().toLowerCase().email('Escribe un correo válido.').max(160),
    contrasena,
    rol: z.enum(['PRODUCTOR', 'COORDINADOR', 'ADMINISTRADOR'], { message: 'Selecciona un rol.' }),
    vereda: z.string().trim().max(120).optional(),
    telefono: esquemaTelefono,
  })
  .superRefine((datos, ctx) => {
    if (datos.rol === 'PRODUCTOR' && (!datos.vereda || datos.vereda.length < 2)) {
      ctx.addIssue({ code: 'custom', path: ['vereda'], message: 'La vereda es obligatoria para productores.' });
    }
  });

const esquemaEdicion = z.object({
  nombre: z.string().trim().min(3, 'Mínimo 3 caracteres.').max(120).optional(),
  rol: z.enum(['PRODUCTOR', 'COORDINADOR', 'ADMINISTRADOR']).optional(),
  activo: z.boolean().optional(),
  contrasena: contrasena.optional(),
});

const COLUMNAS = `u.id, u.nombre, u.correo, u.rol, u.activo, u.creado_en, u.actualizado_en,
  p.id AS productor_id, p.vereda`;

rutasUsuarios.get('/', async (req, res) => {
  const filtros = z
    .object({
      rol: z.enum(['PRODUCTOR', 'COORDINADOR', 'ADMINISTRADOR']).optional(),
      q: z.string().trim().max(80).optional(),
    })
    .parse(req.query);
  const valores: unknown[] = [];
  const condiciones: string[] = [];
  if (filtros.rol) {
    valores.push(filtros.rol);
    condiciones.push(`u.rol = $${valores.length}`);
  }
  if (filtros.q) {
    valores.push(`%${filtros.q}%`);
    condiciones.push(`(u.nombre ILIKE $${valores.length} OR u.correo ILIKE $${valores.length})`);
  }
  const { rows } = await consulta(
    `SELECT ${COLUMNAS} FROM usuarios u LEFT JOIN productores p ON p.usuario_id = u.id
     ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
     ORDER BY u.activo DESC, u.nombre LIMIT 300`,
    valores,
  );
  res.json({ datos: rows });
});

rutasUsuarios.post('/', async (req, res) => {
  const datos = esquemaAlta.parse(req.body);
  const actor = usuarioActual(req);
  const hash = await hashContrasena(datos.contrasena);
  const creado = await transaccion(async (cliente) => {
    const existe = await cliente.query('SELECT 1 FROM usuarios WHERE lower(correo) = $1', [datos.correo]);
    if (existe.rowCount) throw conflicto('Ya existe una cuenta con ese correo.');
    const { rows } = await cliente.query<{ id: string }>(
      'INSERT INTO usuarios (nombre, correo, hash_contrasena, rol) VALUES ($1, $2, $3, $4) RETURNING id',
      [datos.nombre, datos.correo, hash, datos.rol],
    );
    const id = rows[0].id;
    if (datos.rol === 'PRODUCTOR') {
      await cliente.query(
        'INSERT INTO productores (usuario_id, nombre_publico, telefono, vereda) VALUES ($1, $2, $3, $4)',
        [id, datos.nombre, datos.telefono ?? null, datos.vereda],
      );
    }
    await cliente.query(
      'INSERT INTO auditoria_usuarios (actor_id, usuario_id, accion, detalle) VALUES ($1, $2, $3, $4)',
      [actor.id, id, 'ALTA', { rol: datos.rol, correo: datos.correo }],
    );
    const resultado = await cliente.query(
      `SELECT ${COLUMNAS} FROM usuarios u LEFT JOIN productores p ON p.usuario_id = u.id WHERE u.id = $1`,
      [id],
    );
    return resultado.rows[0];
  });
  res.status(201).json(creado);
});

rutasUsuarios.patch('/:id', async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const cambios = esquemaEdicion.parse(req.body);
  const actor = usuarioActual(req);
  const hash = cambios.contrasena ? await hashContrasena(cambios.contrasena) : null;

  const actualizado = await transaccion(async (cliente) => {
    const { rows } = await cliente.query<{ id: string; nombre: string; rol: string; activo: boolean }>(
      'SELECT id, nombre, rol, activo FROM usuarios WHERE id = $1 FOR UPDATE',
      [id],
    );
    const usuario = rows[0];
    if (!usuario) throw noEncontrado('La cuenta no existe.');

    if (id === actor.id && (cambios.activo === false || (cambios.rol && cambios.rol !== usuario.rol))) {
      throw conflicto('No puedes desactivar tu propia cuenta ni cambiar tu propio rol.');
    }
    if (cambios.rol && cambios.rol !== usuario.rol && (cambios.rol === 'PRODUCTOR' || usuario.rol === 'PRODUCTOR')) {
      throw invalido('Revisa los campos marcados.', {
        rol: 'El rol Productor está ligado a un perfil y a sus solicitudes. Crea una cuenta nueva en lugar de cambiarlo.',
      });
    }

    const auditoria: Array<[string, Record<string, unknown>]> = [];
    if (cambios.nombre && cambios.nombre !== usuario.nombre) {
      auditoria.push(['CAMBIO_NOMBRE', { antes: usuario.nombre, despues: cambios.nombre }]);
    }
    if (cambios.rol && cambios.rol !== usuario.rol) {
      auditoria.push(['CAMBIO_ROL', { antes: usuario.rol, despues: cambios.rol }]);
    }
    if (cambios.activo !== undefined && cambios.activo !== usuario.activo) {
      auditoria.push([cambios.activo ? 'ACTIVACION' : 'DESACTIVACION', {}]);
    }
    if (hash) auditoria.push(['CAMBIO_CONTRASENA', {}]);

    await cliente.query(
      `UPDATE usuarios
          SET nombre = COALESCE($2, nombre),
              rol = COALESCE($3, rol),
              activo = COALESCE($4, activo),
              hash_contrasena = COALESCE($5, hash_contrasena),
              actualizado_en = now()
        WHERE id = $1`,
      [id, cambios.nombre ?? null, cambios.rol ?? null, cambios.activo ?? null, hash],
    );
    // Un cambio de rol, desactivación o nueva contraseña cierra las sesiones abiertas de esa cuenta
    if (auditoria.some(([accion]) => ['CAMBIO_ROL', 'DESACTIVACION', 'CAMBIO_CONTRASENA'].includes(accion))) {
      await revocarSesionesDeUsuario(id, cliente);
    }
    for (const [accion, detalle] of auditoria) {
      await cliente.query(
        'INSERT INTO auditoria_usuarios (actor_id, usuario_id, accion, detalle) VALUES ($1, $2, $3, $4)',
        [actor.id, id, accion, detalle],
      );
    }
    const resultado = await cliente.query(
      `SELECT ${COLUMNAS} FROM usuarios u LEFT JOIN productores p ON p.usuario_id = u.id WHERE u.id = $1`,
      [id],
    );
    return resultado.rows[0];
  });
  res.json(actualizado);
});

rutasUsuarios.get('/:id/auditoria', async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const { rows } = await consulta(
    `SELECT a.id, a.accion, a.detalle, a.creado_en, actor.nombre AS actor_nombre
       FROM auditoria_usuarios a LEFT JOIN usuarios actor ON actor.id = a.actor_id
      WHERE a.usuario_id = $1 ORDER BY a.id DESC LIMIT 100`,
    [id],
  );
  res.json({ datos: rows });
});
