import { Router } from 'express';
import { z } from 'zod';
import { obtenerPool } from '../db/pool';
import { requiereRol, requiereSesion, usuarioActual } from '../middleware/auth';
import * as repo from '../repositories/solicitudes';
import { ESTADOS } from '../repositories/solicitudes';
import * as servicio from '../services/solicitudes';
import { noEncontrado } from '../utils/errores';
import { esFechaReal } from '../utils/fechas';
import { esquemaTelefono } from './productores';

export const rutasSolicitudes = Router();
rutasSolicitudes.use(requiereSesion);

const fecha = (mensaje: string) => z.string({ message: mensaje }).refine(esFechaReal, mensaje);
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v));

const camposSolicitud = {
  producto_id: z.uuid({ message: 'Selecciona un producto.' }),
  cantidad: z.coerce
    .number({ message: 'Escribe una cantidad numérica.' })
    .positive('La cantidad debe ser mayor que cero.')
    .max(1_000_000, 'La cantidad es demasiado grande.')
    .refine((v) => Number.isInteger(v * 100), 'Usa máximo dos decimales.'),
  unidad: z.string({ message: 'Selecciona la unidad.' }).trim().min(1, 'Selecciona la unidad.').max(30).toLowerCase(),
  ubicacion_texto: z
    .string({ message: 'Describe la ubicación.' })
    .trim()
    .min(5, 'Describe la vereda y un punto de referencia (mínimo 5 caracteres).')
    .max(250, 'Máximo 250 caracteres.'),
  latitud: z.number().min(-90).max(90).nullable().optional(),
  longitud: z.number().min(-180).max(180).nullable().optional(),
  fecha_disponible: fecha('Revisa la fecha disponible.'),
  notas: textoOpcional(500),
};

const coordenadasCompletas = (d: { latitud?: number | null; longitud?: number | null }) =>
  (d.latitud == null) === (d.longitud == null);

const esquemaCrear = z
  .object(camposSolicitud)
  .strict()
  .refine(coordenadasCompletas, { message: 'Indica latitud y longitud, o ninguna.', path: ['latitud'] });

const esquemaEditar = z
  .object({ ...camposSolicitud, motivo: textoOpcional(300) })
  .partial()
  .strict();

const esquemaProgramacion = z
  .object({
    fecha_programada: fecha('Revisa la fecha programada.'),
    franja: z.enum(['MANANA', 'TARDE', 'JORNADA_COMPLETA'], { message: 'Selecciona la franja de atención.' }),
    motivo: textoOpcional(300),
    transporte: z
      .object({
        nombre_contacto: z.string().trim().min(3, 'Escribe el nombre del contacto.').max(120),
        telefono: esquemaTelefono,
        tipo_vehiculo: textoOpcional(60),
        observaciones: textoOpcional(300),
      })
      .nullable()
      .optional(),
  })
  .strict();

const esquemaEstado = z.object({
  estado: z.enum(ESTADOS, { message: 'Estado no válido.' }),
  motivo: textoOpcional(300),
});

const esquemaFiltros = z.object({
  estado: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : undefined))
    .pipe(z.array(z.enum(ESTADOS)).optional()),
  producto_id: z.uuid().optional(),
  desde: fecha('Fecha inicial no válida.').optional(),
  hasta: fecha('Fecha final no válida.').optional(),
  q: z.string().trim().max(60).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().refine((v) => [10, 20, 50].includes(v), 'Usa 10, 20 o 50.').default(10),
  orden: z.enum(['recientes', 'fecha_disponible', 'fecha_programada']).default('recientes'),
});

const idValido = (valor: unknown) => {
  const r = z.uuid().safeParse(valor);
  if (!r.success) throw noEncontrado('La solicitud no existe o no tienes acceso a ella.');
  return r.data;
};

rutasSolicitudes.get('/', async (req, res) => {
  const usuario = usuarioActual(req);
  const filtros = esquemaFiltros.parse(req.query);
  const { filas, total } = await repo.listar(obtenerPool(), usuario, filtros);
  res.json({
    datos: filas.map((f) => servicio.serializar(f, usuario)),
    total,
    pagina: filtros.pagina,
    tamano: filtros.tamano,
  });
});

rutasSolicitudes.get('/resumen', async (req, res) => {
  res.json(await repo.resumen(obtenerPool(), usuarioActual(req)));
});

rutasSolicitudes.post('/', requiereRol('PRODUCTOR'), async (req, res) => {
  const datos = esquemaCrear.parse(req.body);
  const solicitud = await servicio.crear(usuarioActual(req), datos);
  res.status(201).location(`/api/solicitudes/${solicitud.id}`).json(solicitud);
});

rutasSolicitudes.get('/:id', async (req, res) => {
  const usuario = usuarioActual(req);
  const fila = await repo.obtener(obtenerPool(), usuario, idValido(req.params.id));
  if (!fila) throw noEncontrado('La solicitud no existe o no tienes acceso a ella.');
  res.json(servicio.serializar(fila, usuario));
});

rutasSolicitudes.patch('/:id', async (req, res) => {
  const cambios = esquemaEditar.parse(req.body);
  res.json(await servicio.editar(usuarioActual(req), idValido(req.params.id), cambios));
});

rutasSolicitudes.put('/:id/programacion', requiereRol('COORDINADOR', 'ADMINISTRADOR'), async (req, res) => {
  const datos = esquemaProgramacion.parse(req.body);
  res.json(await servicio.programar(usuarioActual(req), idValido(req.params.id), datos));
});

rutasSolicitudes.patch('/:id/estado', requiereRol('COORDINADOR', 'ADMINISTRADOR'), async (req, res) => {
  const { estado, motivo } = esquemaEstado.parse(req.body);
  res.json(await servicio.cambiarEstado(usuarioActual(req), idValido(req.params.id), estado, motivo));
});

rutasSolicitudes.get('/:id/historial', async (req, res) => {
  const usuario = usuarioActual(req);
  const id = idValido(req.params.id);
  // Verifica primero el acceso a la solicitud
  const fila = await repo.obtener(obtenerPool(), usuario, id);
  if (!fila) throw noEncontrado('La solicitud no existe o no tienes acceso a ella.');
  res.json({ datos: await repo.historial(obtenerPool(), id) });
});
