import request from 'supertest';
import { crearApp } from '../src/app';
import { hoyEnBogota, sumarDias } from '../src/utils/fechas';
import { CONTRASENA_PRUEBA } from './preparar-base';

export const app = crearApp();
export const CABECERA = { 'X-Requested-With': 'AgroTurno' };
export const enDias = (n: number) => sumarDias(hoyEnBogota(), n);

/** Agente con sesión iniciada; reenvía la cookie HttpOnly en cada petición */
export async function sesion(correo: string, contrasena = CONTRASENA_PRUEBA) {
  const agente = request.agent(app);
  const r = await agente.post('/api/auth/login').set(CABECERA).send({ correo, contrasena });
  if (r.status !== 200) throw new Error(`No se pudo iniciar sesión con ${correo}: ${r.status} ${JSON.stringify(r.body)}`);
  return agente;
}

export async function productoId(agente: Awaited<ReturnType<typeof sesion>>, nombre: string) {
  const r = await agente.get('/api/productos');
  return r.body.datos.find((p: { nombre: string }) => p.nombre === nombre)?.id as string;
}

export async function crearSolicitud(agente: Awaited<ReturnType<typeof sesion>>, extra: Record<string, unknown> = {}) {
  const producto_id = await productoId(agente, 'Plátano');
  const r = await agente
    .post('/api/solicitudes')
    .set(CABECERA)
    .send({
      producto_id,
      cantidad: 45,
      unidad: 'racimos',
      ubicacion_texto: 'Vereda Uno, punto de referencia ficticio',
      fecha_disponible: enDias(2),
      ...extra,
    });
  if (r.status !== 201) throw new Error(`Creación falló: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}
