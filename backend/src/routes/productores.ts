import { Router } from 'express';
import { z } from 'zod';
import { consulta } from '../db/pool';
import { requiereRol, requiereSesion, usuarioActual } from '../middleware/auth';
import { noEncontrado } from '../utils/errores';

export const rutasProductores = Router();
rutasProductores.use(requiereSesion);

export const esquemaTelefono = z
  .string()
  .trim()
  .regex(/^[0-9+\s-]{7,20}$/, 'Escribe solo números (7 a 20 dígitos).')
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null));

const esquemaPerfilPropio = z.object({
  telefono: esquemaTelefono,
  vereda: z.string().trim().min(2, 'Escribe la vereda.').max(120).optional(),
});

const esquemaEdicionAdmin = esquemaPerfilPropio.extend({
  nombre_publico: z.string().trim().min(3, 'Mínimo 3 caracteres.').max(120).optional(),
});

const COLUMNAS = `p.id, p.nombre_publico, p.telefono, p.vereda, p.usuario_id, u.correo, u.activo,
  (SELECT count(*) FROM solicitudes s WHERE s.productor_id = p.id) AS total_solicitudes`;

// Consulta de productores: solo coordinación y administración (RN-08)
rutasProductores.get('/', requiereRol('COORDINADOR', 'ADMINISTRADOR'), async (req, res) => {
  const filtros = z
    .object({ q: z.string().trim().max(80).optional(), vereda: z.string().trim().max(120).optional() })
    .parse(req.query);
  const condiciones: string[] = [];
  const valores: unknown[] = [];
  if (filtros.q) {
    valores.push(`%${filtros.q}%`);
    condiciones.push(`p.nombre_publico ILIKE $${valores.length}`);
  }
  if (filtros.vereda) {
    valores.push(`%${filtros.vereda}%`);
    condiciones.push(`p.vereda ILIKE $${valores.length}`);
  }
  const { rows } = await consulta(
    `SELECT ${COLUMNAS}
       FROM productores p LEFT JOIN usuarios u ON u.id = p.usuario_id
       ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
      ORDER BY p.nombre_publico
      LIMIT 200`,
    valores,
  );
  res.json({ datos: rows });
});

// Perfil propio del productor autenticado
rutasProductores.get('/me', requiereRol('PRODUCTOR'), async (req, res) => {
  const { rows } = await consulta(
    `SELECT ${COLUMNAS} FROM productores p LEFT JOIN usuarios u ON u.id = p.usuario_id WHERE p.id = $1`,
    [usuarioActual(req).productorId],
  );
  if (!rows[0]) throw noEncontrado('Tu cuenta no tiene perfil de productor. Comunícate con el administrador.');
  res.json(rows[0]);
});

rutasProductores.patch('/me', requiereRol('PRODUCTOR'), async (req, res) => {
  const datos = esquemaPerfilPropio.parse(req.body);
  const { rows } = await consulta(
    `UPDATE productores
        SET telefono = CASE WHEN $2::boolean THEN $3 ELSE telefono END,
            vereda = COALESCE($4, vereda),
            actualizado_en = now()
      WHERE id = $1
  RETURNING id, nombre_publico, telefono, vereda`,
    [usuarioActual(req).productorId, datos.telefono !== undefined, datos.telefono ?? null, datos.vereda ?? null],
  );
  if (!rows[0]) throw noEncontrado();
  res.json(rows[0]);
});

rutasProductores.patch('/:id', requiereRol('ADMINISTRADOR'), async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const datos = esquemaEdicionAdmin.parse(req.body);
  const { rows } = await consulta(
    `UPDATE productores
        SET nombre_publico = COALESCE($2, nombre_publico),
            telefono = CASE WHEN $3::boolean THEN $4 ELSE telefono END,
            vereda = COALESCE($5, vereda),
            actualizado_en = now()
      WHERE id = $1
  RETURNING id, nombre_publico, telefono, vereda`,
    [id, datos.nombre_publico ?? null, datos.telefono !== undefined, datos.telefono ?? null, datos.vereda ?? null],
  );
  if (!rows[0]) throw noEncontrado('El productor no existe.');
  res.json(rows[0]);
});
