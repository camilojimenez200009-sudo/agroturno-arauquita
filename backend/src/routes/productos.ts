import { Router } from 'express';
import { z } from 'zod';
import { consulta } from '../db/pool';
import { requiereRol, requiereSesion, usuarioActual } from '../middleware/auth';
import { invalido, noEncontrado } from '../utils/errores';

export const rutasProductos = Router();
rutasProductos.use(requiereSesion);

const unidad = z.string().trim().min(2, 'Mínimo 2 caracteres.').max(30).transform((v) => v.toLowerCase());

const esquemaProducto = z.object({
  nombre: z.string().trim().min(3, 'Mínimo 3 caracteres.').max(80),
  unidades: z.array(unidad).min(1, 'Agrega al menos una unidad.').max(8),
  unidad_defecto: unidad,
  activo: z.boolean().optional(),
});

const esquemaEdicion = esquemaProducto.partial();

function normalizarUnidades(unidades: string[], unidadDefecto: string) {
  const lista = Array.from(new Set(unidades));
  if (!lista.includes(unidadDefecto)) {
    throw invalido('Revisa los campos marcados.', { unidad_defecto: 'Debe ser una de las unidades del producto.' });
  }
  return lista;
}

const COLUMNAS = 'id, nombre, unidad_defecto, unidades, activo, actualizado_en';

// Catálogo vigente: todos los roles. El administrador puede incluir productos inactivos.
rutasProductos.get('/', async (req, res) => {
  const incluirInactivos = req.query.incluirInactivos === 'true' && usuarioActual(req).rol === 'ADMINISTRADOR';
  const { rows } = await consulta(
    `SELECT ${COLUMNAS} FROM productos ${incluirInactivos ? '' : 'WHERE activo'} ORDER BY activo DESC, nombre`,
  );
  res.json({ datos: rows });
});

rutasProductos.post('/', requiereRol('ADMINISTRADOR'), async (req, res) => {
  const datos = esquemaProducto.parse(req.body);
  const unidades = normalizarUnidades(datos.unidades, datos.unidad_defecto);
  const { rows } = await consulta(
    `INSERT INTO productos (nombre, unidad_defecto, unidades, activo)
     VALUES ($1, $2, $3, $4) RETURNING ${COLUMNAS}`,
    [datos.nombre, datos.unidad_defecto, unidades, datos.activo ?? true],
  );
  res.status(201).json(rows[0]);
});

rutasProductos.patch('/:id', requiereRol('ADMINISTRADOR'), async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const cambios = esquemaEdicion.parse(req.body);
  const actual = await consulta<{ unidades: string[]; unidad_defecto: string }>(
    'SELECT unidades, unidad_defecto FROM productos WHERE id = $1',
    [id],
  );
  if (!actual.rows[0]) throw noEncontrado('El producto no existe.');
  const unidadDefecto = cambios.unidad_defecto ?? actual.rows[0].unidad_defecto;
  const unidades = normalizarUnidades(cambios.unidades ?? actual.rows[0].unidades, unidadDefecto);
  const { rows } = await consulta(
    `UPDATE productos
        SET nombre = COALESCE($2, nombre),
            unidades = $3,
            unidad_defecto = $4,
            activo = COALESCE($5, activo),
            actualizado_en = now()
      WHERE id = $1
  RETURNING ${COLUMNAS}`,
    [id, cambios.nombre ?? null, unidades, unidadDefecto, cambios.activo ?? null],
  );
  res.json(rows[0]);
});
