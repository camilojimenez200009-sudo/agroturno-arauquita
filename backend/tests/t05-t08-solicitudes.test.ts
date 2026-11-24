import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { CABECERA, crearSolicitud, enDias, productoId, sesion } from './utilidades';

async function contarSolicitudes() {
  const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL_ADMIN });
  await db.connect();
  const { rows } = await db.query('SELECT count(*)::int AS n FROM agroturno.solicitudes');
  await db.end();
  return rows[0].n as number;
}

describe('T05 · Registro de solicitudes (RF-05, RN-01 a RN-03)', () => {
  it('campos válidos → 201, código legible, estado PENDIENTE y evento de creación', async () => {
    const pa = await sesion('pa@prueba.test');
    const s = await crearSolicitud(pa);
    expect(s.codigo).toMatch(/^AT-\d{5}$/);
    expect(s.estado).toBe('PENDIENTE');
    expect(s.productor.nombre).toBe('Productor A');
    const h = await pa.get(`/api/solicitudes/${s.id}/historial`);
    expect(h.body.datos).toHaveLength(1);
    expect(h.body.datos[0]).toMatchObject({ accion: 'CREACION', estado_nuevo: 'PENDIENTE', usuario_nombre: 'Productor A' });
  });

  it('datos inválidos → 422 con mensajes por campo y sin registros parciales', async () => {
    const pa = await sesion('pa@prueba.test');
    const antes = await contarSolicitudes();
    const r = await pa.post('/api/solicitudes').set(CABECERA).send({ cantidad: 0, unidad: '', ubicacion_texto: 'x', fecha_disponible: '2026-02-30' });
    expect(r.status).toBe(422);
    expect(Object.keys(r.body.error.campos)).toEqual(
      expect.arrayContaining(['producto_id', 'cantidad', 'unidad', 'ubicacion_texto', 'fecha_disponible']),
    );
    expect(await contarSolicitudes()).toBe(antes);
  });

  it('rechaza fecha disponible en el pasado y unidad incoherente con el producto', async () => {
    const pa = await sesion('pa@prueba.test');
    const pasado = await pa.post('/api/solicitudes').set(CABECERA).send({
      producto_id: await productoId(pa, 'Plátano'),
      cantidad: 5,
      unidad: 'racimos',
      ubicacion_texto: 'Vereda Uno, referencia',
      fecha_disponible: enDias(-1),
    });
    expect(pasado.status).toBe(422);
    expect(pasado.body.error.mensaje).toBe('Revisa la fecha disponible.');
    const unidad = await pa.post('/api/solicitudes').set(CABECERA).send({
      producto_id: await productoId(pa, 'Plátano'),
      cantidad: 5,
      unidad: 'bultos',
      ubicacion_texto: 'Vereda Uno, referencia',
      fecha_disponible: enDias(1),
    });
    expect(unidad.status).toBe(422);
    expect(unidad.body.error.campos.unidad).toContain('racimos');
  });

  it('ignora cualquier productor_id enviado: el productor es el de la sesión', async () => {
    const pa = await sesion('pa@prueba.test');
    const r = await pa.post('/api/solicitudes').set(CABECERA).send({
      producto_id: await productoId(pa, 'Plátano'),
      productor_id: '00000000-0000-0000-0000-000000000000',
      cantidad: 5,
      unidad: 'racimos',
      ubicacion_texto: 'Vereda Uno, referencia',
      fecha_disponible: enDias(1),
    });
    // El esquema es estricto: un campo no permitido se rechaza en lugar de usarse
    expect(r.status).toBe(422);
  });

  it('coordinación no registra solicitudes a nombre de terceros', async () => {
    const c = await sesion('coord@prueba.test');
    const r = await c.post('/api/solicitudes').set(CABECERA).send({});
    expect(r.status).toBe(403);
  });
});

describe('T06 · Consultas, filtros y permisos (RF-06, RN-08)', () => {
  it('cada productor ve solo sus solicitudes; coordinación ve todas', async () => {
    const pa = await sesion('pa@prueba.test');
    const pb = await sesion('pb@prueba.test');
    const deB = await crearSolicitud(pb, { ubicacion_texto: 'Vereda Dos, referencia de B' });
    const listaA = await pa.get('/api/solicitudes?tamano=50');
    expect(listaA.body.datos.every((s: { productor: { nombre: string } }) => s.productor.nombre === 'Productor A')).toBe(true);
    expect((await pa.get(`/api/solicitudes/${deB.id}`)).status).toBe(404);
    expect((await pa.get(`/api/solicitudes/${deB.id}/historial`)).status).toBe(404);
    const c = await sesion('coord@prueba.test');
    const todas = await c.get('/api/solicitudes?tamano=50');
    const nombres = new Set(todas.body.datos.map((s: { productor: { nombre: string } }) => s.productor.nombre));
    expect(nombres.has('Productor A') && nombres.has('Productor B')).toBe(true);
  });

  it('los filtros por estado, producto, fecha y código se combinan', async () => {
    const pa = await sesion('pa@prueba.test');
    const cacao = await productoId(pa, 'Cacao');
    const s = await crearSolicitud(pa, { producto_id: cacao, unidad: 'kilogramos', fecha_disponible: enDias(10) });
    const r = await pa.get(`/api/solicitudes?estado=PENDIENTE&producto_id=${cacao}&desde=${enDias(9)}&hasta=${enDias(11)}`);
    expect(r.body.datos.map((x: { id: string }) => x.id)).toEqual([s.id]);
    const porCodigo = await pa.get(`/api/solicitudes?q=${s.codigo}`);
    expect(porCodigo.body.total).toBe(1);
    const vacio = await pa.get(`/api/solicitudes?estado=COMPLETADA&producto_id=${cacao}`);
    expect(vacio.body.total).toBe(0);
  });

  it('pagina resultados y limita el tamaño de página', async () => {
    const c = await sesion('coord@prueba.test');
    const r = await c.get('/api/solicitudes?tamano=10&pagina=1');
    expect(r.body.datos.length).toBeLessThanOrEqual(10);
    expect(r.body).toMatchObject({ pagina: 1, tamano: 10 });
    expect((await c.get('/api/solicitudes?tamano=5000')).status).toBe(422);
  });

  it('los contadores del tablero respetan la autorización', async () => {
    const pb = await sesion('pb@prueba.test');
    const resumen = await pb.get('/api/solicitudes/resumen');
    const lista = await pb.get('/api/solicitudes?tamano=50');
    const total = Object.values(resumen.body as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(total).toBe(lista.body.total);
  });

  it('el productor no recibe teléfonos de otros actores', async () => {
    const pa = await sesion('pa@prueba.test');
    const r = await pa.get('/api/solicitudes?tamano=10');
    expect(r.body.datos[0].productor).not.toHaveProperty('telefono');
    const c = await sesion('coord@prueba.test');
    const rc = await c.get('/api/solicitudes?tamano=10');
    expect(rc.body.datos[0].productor).toHaveProperty('telefono');
  });
});

describe('T07 · Edición autorizada con historial (RF-07)', () => {
  it('el productor edita su solicitud pendiente y el cambio queda en el historial', async () => {
    const pa = await sesion('pa@prueba.test');
    const s = await crearSolicitud(pa);
    const r = await pa.patch(`/api/solicitudes/${s.id}`).set(CABECERA).send({ cantidad: 50 });
    expect(r.status).toBe(200);
    expect(r.body.cantidad).toBe(50);
    const h = await pa.get(`/api/solicitudes/${s.id}/historial`);
    const edicion = h.body.datos.find((e: { accion: string }) => e.accion === 'EDICION');
    expect(edicion.detalle.cambios.cantidad).toEqual({ antes: 45, despues: 50 });
  });

  it('otro productor no puede editarla y sin cambios no se registra nada', async () => {
    const pa = await sesion('pa@prueba.test');
    const pb = await sesion('pb@prueba.test');
    const s = await crearSolicitud(pa);
    expect((await pb.patch(`/api/solicitudes/${s.id}`).set(CABECERA).send({ cantidad: 1 })).status).toBe(404);
    expect((await pa.patch(`/api/solicitudes/${s.id}`).set(CABECERA).send({ cantidad: 45 })).status).toBe(400);
  });

  it('el productor no edita una solicitud ya programada', async () => {
    const pa = await sesion('pa@prueba.test');
    const c = await sesion('coord@prueba.test');
    const s = await crearSolicitud(pa);
    await c.put(`/api/solicitudes/${s.id}/programacion`).set(CABECERA).send({ fecha_programada: enDias(3), franja: 'MANANA' });
    const r = await pa.patch(`/api/solicitudes/${s.id}`).set(CABECERA).send({ cantidad: 10 });
    expect(r.status).toBe(409);
  });
});

describe('T08 · Ubicación textual y coordenadas opcionales (RF-08, RN-07)', () => {
  it('guarda una solicitud solo con texto y otra con coordenadas', async () => {
    const pa = await sesion('pa@prueba.test');
    const soloTexto = await crearSolicitud(pa);
    expect(soloTexto.latitud).toBeNull();
    expect(soloTexto.ubicacion_texto).toContain('Vereda Uno');
    const conPunto = await crearSolicitud(pa, { latitud: 7.0251, longitud: -71.4396 });
    expect(conPunto.latitud).toBeCloseTo(7.0251);
  });

  it('rechaza coordenadas incompletas, fuera de rango o sin texto', async () => {
    const pa = await sesion('pa@prueba.test');
    const base = {
      producto_id: await productoId(pa, 'Plátano'),
      cantidad: 3,
      unidad: 'racimos',
      ubicacion_texto: 'Vereda Uno, referencia',
      fecha_disponible: enDias(1),
    };
    expect((await pa.post('/api/solicitudes').set(CABECERA).send({ ...base, latitud: 7 })).status).toBe(422);
    expect((await pa.post('/api/solicitudes').set(CABECERA).send({ ...base, latitud: 95, longitud: 0 })).status).toBe(422);
    expect((await pa.post('/api/solicitudes').set(CABECERA).send({ ...base, ubicacion_texto: '   ' })).status).toBe(422);
  });

  it('coordinación corrige la ubicación y la corrección queda registrada', async () => {
    const pa = await sesion('pa@prueba.test');
    const c = await sesion('coord@prueba.test');
    const s = await crearSolicitud(pa);
    const r = await c
      .patch(`/api/solicitudes/${s.id}`)
      .set(CABECERA)
      .send({ ubicacion_texto: 'Vereda Uno, entrada corregida', latitud: 7.03, longitud: -71.42, motivo: 'Punto confirmado por teléfono' });
    expect(r.status).toBe(200);
    const h = await c.get(`/api/solicitudes/${s.id}/historial`);
    const e = h.body.datos.at(-1);
    expect(e.accion).toBe('EDICION');
    expect(e.motivo).toBe('Punto confirmado por teléfono');
    expect(Object.keys(e.detalle.cambios)).toEqual(expect.arrayContaining(['ubicacion_texto', 'latitud', 'longitud']));
  });
});
