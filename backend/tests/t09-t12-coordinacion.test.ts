import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { CABECERA, crearSolicitud, enDias, sesion } from './utilidades';

describe('T09 · Programación de la atención (RF-09)', () => {
  it('coordinación asigna fecha y franja; la solicitud pasa a PROGRAMADA', async () => {
    const pa = await sesion('pa@prueba.test');
    const c = await sesion('coord@prueba.test');
    const s = await crearSolicitud(pa);
    const r = await c.put(`/api/solicitudes/${s.id}/programacion`).set(CABECERA).send({ fecha_programada: enDias(3), franja: 'MANANA' });
    expect(r.status).toBe(200);
    expect(r.body.estado).toBe('PROGRAMADA');
    expect(r.body.programacion).toMatchObject({ fecha_programada: enDias(3), franja: 'MANANA', coordinador: 'Coordinador Prueba' });
  });

  it('el productor no programa', async () => {
    const pa = await sesion('pa@prueba.test');
    const s = await crearSolicitud(pa);
    expect((await pa.put(`/api/solicitudes/${s.id}/programacion`).set(CABECERA).send({ fecha_programada: enDias(3), franja: 'MANANA' })).status).toBe(403);
  });

  it('no programa antes de la fecha disponible ni en el pasado', async () => {
    const pa = await sesion('pa@prueba.test');
    const c = await sesion('coord@prueba.test');
    const s = await crearSolicitud(pa, { fecha_disponible: enDias(5) });
    expect((await c.put(`/api/solicitudes/${s.id}/programacion`).set(CABECERA).send({ fecha_programada: enDias(4), franja: 'TARDE' })).status).toBe(422);
    expect((await c.put(`/api/solicitudes/${s.id}/programacion`).set(CABECERA).send({ fecha_programada: enDias(-1), franja: 'TARDE' })).status).toBe(422);
  });

  it('una reprogramación exige motivo y conserva fecha anterior y nueva (caso O03: lluvia)', async () => {
    const pa = await sesion('pa@prueba.test');
    const c = await sesion('coord@prueba.test');
    const s = await crearSolicitud(pa);
    await c.put(`/api/solicitudes/${s.id}/programacion`).set(CABECERA).send({ fecha_programada: enDias(3), franja: 'MANANA' });
    const sinMotivo = await c.put(`/api/solicitudes/${s.id}/programacion`).set(CABECERA).send({ fecha_programada: enDias(4), franja: 'MANANA' });
    expect(sinMotivo.status).toBe(422);
    expect(sinMotivo.body.error.campos.motivo).toBeDefined();
    const ok = await c
      .put(`/api/solicitudes/${s.id}/programacion`)
      .set(CABECERA)
      .send({ fecha_programada: enDias(4), franja: 'MANANA', motivo: 'Aplazamiento de 24 h por lluvia' });
    expect(ok.status).toBe(200);
    expect(ok.body.estado).toBe('PROGRAMADA');
    const h = await c.get(`/api/solicitudes/${s.id}/historial`);
    const rep = h.body.datos.find((e: { accion: string }) => e.accion === 'REPROGRAMACION');
    expect(rep.detalle.antes.fecha_programada).toBe(enDias(3));
    expect(rep.detalle.despues.fecha_programada).toBe(enDias(4));
    expect(rep.motivo).toBe('Aplazamiento de 24 h por lluvia');
  });
});

describe('T10 · Datos de transporte (RF-10)', () => {
  it('asocia un contacto visible con teléfono solo para coordinación', async () => {
    const pa = await sesion('pa@prueba.test');
    const c = await sesion('coord@prueba.test');
    const s = await crearSolicitud(pa);
    const r = await c
      .put(`/api/solicitudes/${s.id}/programacion`)
      .set(CABECERA)
      .send({
        fecha_programada: enDias(3),
        franja: 'JORNADA_COMPLETA',
        transporte: { nombre_contacto: 'Transportador ficticio', telefono: '3200000000', tipo_vehiculo: 'Camión 350' },
      });
    expect(r.body.programacion.transporte).toMatchObject({ nombre_contacto: 'Transportador ficticio', telefono: '3200000000' });
    const vistaProductor = await pa.get(`/api/solicitudes/${s.id}`);
    expect(vistaProductor.body.programacion.transporte.nombre_contacto).toBe('Transportador ficticio');
    expect(vistaProductor.body.programacion.transporte).not.toHaveProperty('telefono');
    // El historial registra el cambio sin guardar el teléfono
    const h = await c.get(`/api/solicitudes/${s.id}/historial`);
    expect(JSON.stringify(h.body)).not.toContain('3200000000');
    expect(h.body.datos.some((e: { accion: string }) => e.accion === 'TRANSPORTE')).toBe(true);
  });
});

describe('T11 · Transiciones de estado (RF-11)', () => {
  it('sigue la secuencia permitida y responde 409 ante saltos o retrocesos', async () => {
    const pa = await sesion('pa@prueba.test');
    const c = await sesion('coord@prueba.test');
    const s = await crearSolicitud(pa);
    const estado = (e: string) => c.patch(`/api/solicitudes/${s.id}/estado`).set(CABECERA).send({ estado: e });

    expect((await estado('EN_PROCESO')).status).toBe(409); // PENDIENTE → EN_PROCESO
    expect((await estado('PROGRAMADA')).status).toBe(409); // debe usarse la programación
    await c.put(`/api/solicitudes/${s.id}/programacion`).set(CABECERA).send({ fecha_programada: enDias(3), franja: 'MANANA' });
    expect((await estado('COMPLETADA')).status).toBe(409); // PROGRAMADA → COMPLETADA
    expect((await estado('EN_PROCESO')).body.estado).toBe('EN_PROCESO');
    expect((await estado('PENDIENTE')).status).toBe(409); // retroceso
    expect((await estado('COMPLETADA')).body.estado).toBe('COMPLETADA');
    expect((await estado('EN_PROCESO')).status).toBe(409);
    // Una solicitud completada ya no se edita ni se reprograma
    expect((await c.patch(`/api/solicitudes/${s.id}`).set(CABECERA).send({ cantidad: 1 })).status).toBe(409);
    expect((await c.put(`/api/solicitudes/${s.id}/programacion`).set(CABECERA).send({ fecha_programada: enDias(5), franja: 'TARDE', motivo: 'otro intento' })).status).toBe(409);
  });

  it('el productor no cambia estados', async () => {
    const pa = await sesion('pa@prueba.test');
    const s = await crearSolicitud(pa);
    expect((await pa.patch(`/api/solicitudes/${s.id}/estado`).set(CABECERA).send({ estado: 'EN_PROCESO' })).status).toBe(403);
  });

  it('dos cambios simultáneos no producen estados duplicados', async () => {
    const pa = await sesion('pa@prueba.test');
    const c = await sesion('coord@prueba.test');
    const s = await crearSolicitud(pa);
    await c.put(`/api/solicitudes/${s.id}/programacion`).set(CABECERA).send({ fecha_programada: enDias(3), franja: 'MANANA' });
    const [a, b] = await Promise.all([
      c.patch(`/api/solicitudes/${s.id}/estado`).set(CABECERA).send({ estado: 'EN_PROCESO' }),
      c.patch(`/api/solicitudes/${s.id}/estado`).set(CABECERA).send({ estado: 'EN_PROCESO' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });
});

describe('T12 · Historial cronológico e inmutable (RF-12, RN-05, RN-06)', () => {
  it('registra cada operación con fecha, usuario, acción y orden temporal', async () => {
    const pa = await sesion('pa@prueba.test');
    const c = await sesion('coord@prueba.test');
    const s = await crearSolicitud(pa);
    await c.put(`/api/solicitudes/${s.id}/programacion`).set(CABECERA).send({ fecha_programada: enDias(3), franja: 'MANANA' });
    await c.patch(`/api/solicitudes/${s.id}/estado`).set(CABECERA).send({ estado: 'EN_PROCESO' });
    await c.patch(`/api/solicitudes/${s.id}/estado`).set(CABECERA).send({ estado: 'COMPLETADA', motivo: 'Entregado en acopio' });
    const h = (await pa.get(`/api/solicitudes/${s.id}/historial`)).body.datos;
    expect(h.map((e: { accion: string }) => e.accion)).toEqual(['CREACION', 'PROGRAMACION', 'CAMBIO_ESTADO', 'CAMBIO_ESTADO']);
    expect(h.map((e: { usuario_nombre: string }) => e.usuario_nombre)).toEqual([
      'Productor A',
      'Coordinador Prueba',
      'Coordinador Prueba',
      'Coordinador Prueba',
    ]);
    const tiempos = h.map((e: { creado_en: string }) => new Date(e.creado_en).getTime());
    expect([...tiempos].sort((x, y) => x - y)).toEqual(tiempos);
    expect(h.at(-1)).toMatchObject({ estado_anterior: 'EN_PROCESO', estado_nuevo: 'COMPLETADA', motivo: 'Entregado en acopio' });
  });

  it('la base impide modificar o borrar el historial y borrar solicitudes', async () => {
    const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL_ADMIN });
    await db.connect();
    try {
      await expect(db.query("UPDATE agroturno.historial_solicitudes SET motivo = 'alterado'")).rejects.toThrow(/no admite/);
      await expect(db.query('DELETE FROM agroturno.historial_solicitudes')).rejects.toThrow(/no admite/);
      await expect(db.query('DELETE FROM agroturno.solicitudes')).rejects.toThrow(/no se eliminan/);
    } finally {
      await db.end();
    }
  });

  it('la API no expone ninguna ruta para borrar solicitudes', async () => {
    const pa = await sesion('pa@prueba.test');
    const s = await crearSolicitud(pa);
    const admin = await sesion('admin@prueba.test');
    expect((await admin.delete(`/api/solicitudes/${s.id}`).set(CABECERA)).status).toBe(404);
  });
});
