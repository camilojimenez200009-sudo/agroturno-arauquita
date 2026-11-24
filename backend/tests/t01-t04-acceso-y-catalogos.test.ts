import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { CABECERA, app, enDias, productoId, sesion } from './utilidades';

describe('T01 · Autenticación (RF-01)', () => {
  it('inicia sesión con credenciales válidas y entrega cookie HttpOnly', async () => {
    const r = await request(app).post('/api/auth/login').set(CABECERA).send({ correo: 'pa@prueba.test', contrasena: 'ClavePrueba2026' });
    expect(r.status).toBe(200);
    const cookie = String(r.headers['set-cookie']);
    expect(cookie).toContain('agroturno_sesion=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('rechaza contraseña errónea con mensaje genérico', async () => {
    const r = await request(app).post('/api/auth/login').set(CABECERA).send({ correo: 'pa@prueba.test', contrasena: 'incorrecta' });
    expect(r.status).toBe(401);
    expect(r.body.error.mensaje).toBe('Correo o contraseña incorrectos.');
  });

  it('responde igual para un correo inexistente (no revela cuentas)', async () => {
    const r = await request(app).post('/api/auth/login').set(CABECERA).send({ correo: 'nadie@prueba.test', contrasena: 'x' });
    expect(r.status).toBe(401);
    expect(r.body.error.mensaje).toBe('Correo o contraseña incorrectos.');
  });

  it('bloquea una cuenta desactivada', async () => {
    const r = await request(app).post('/api/auth/login').set(CABECERA).send({ correo: 'inactivo@prueba.test', contrasena: 'ClavePrueba2026' });
    expect(r.status).toBe(403);
  });

  it('/auth/me devuelve identidad y rol; tras cerrar sesión la cookie deja de servir', async () => {
    const agente = await sesion('pa@prueba.test');
    const yo = await agente.get('/api/auth/me');
    expect(yo.status).toBe(200);
    expect(yo.body.usuario.rol).toBe('PRODUCTOR');
    expect(yo.body.usuario).not.toHaveProperty('hash_contrasena');
    expect((await agente.post('/api/auth/logout').set(CABECERA)).status).toBe(200);
    expect((await agente.get('/api/auth/me')).status).toBe(401);
  });

  it('sin sesión, las rutas protegidas responden 401', async () => {
    expect((await request(app).get('/api/solicitudes')).status).toBe(401);
  });
});

describe('T02 · Permisos por rol (RF-02, RN-04)', () => {
  it('un productor no administra usuarios ni productos', async () => {
    const pa = await sesion('pa@prueba.test');
    expect((await pa.get('/api/usuarios')).status).toBe(403);
    expect((await pa.post('/api/productos').set(CABECERA).send({ nombre: 'Yuca', unidades: ['bultos'], unidad_defecto: 'bultos' })).status).toBe(403);
    expect((await pa.get('/api/productores')).status).toBe(403);
  });

  it('un coordinador no administra usuarios', async () => {
    const c = await sesion('coord@prueba.test');
    expect((await c.get('/api/usuarios')).status).toBe(403);
  });

  it('el administrador crea una cuenta y el cambio queda auditado', async () => {
    const admin = await sesion('admin@prueba.test');
    const r = await admin.post('/api/usuarios').set(CABECERA).send({
      nombre: 'Coordinador Nuevo',
      correo: 'nuevo.coord@prueba.test',
      contrasena: 'ClaveSegura123',
      rol: 'COORDINADOR',
    });
    expect(r.status).toBe(201);
    expect(r.body).not.toHaveProperty('hash_contrasena');
    const cambio = await admin.patch(`/api/usuarios/${r.body.id}`).set(CABECERA).send({ rol: 'ADMINISTRADOR' });
    expect(cambio.status).toBe(200);
    expect(cambio.body.rol).toBe('ADMINISTRADOR');
    const auditoria = await admin.get(`/api/usuarios/${r.body.id}/auditoria`);
    expect(auditoria.body.datos.map((a: { accion: string }) => a.accion)).toEqual(['CAMBIO_ROL', 'ALTA']);
  });

  it('desactivar una cuenta cierra sus sesiones abiertas', async () => {
    const admin = await sesion('admin@prueba.test');
    const alta = await admin.post('/api/usuarios').set(CABECERA).send({
      nombre: 'Temporal',
      correo: 'temporal@prueba.test',
      contrasena: 'ClaveSegura123',
      rol: 'COORDINADOR',
    });
    const temporal = await sesion('temporal@prueba.test', 'ClaveSegura123');
    expect((await temporal.get('/api/auth/me')).status).toBe(200);
    await admin.patch(`/api/usuarios/${alta.body.id}`).set(CABECERA).send({ activo: false });
    expect((await temporal.get('/api/auth/me')).status).toBe(401);
  });

  it('rechaza contraseñas débiles y correos duplicados', async () => {
    const admin = await sesion('admin@prueba.test');
    const debil = await admin.post('/api/usuarios').set(CABECERA).send({ nombre: 'X Y Z', correo: 'x@prueba.test', contrasena: '123', rol: 'COORDINADOR' });
    expect(debil.status).toBe(422);
    expect(debil.body.error.campos.contrasena).toBeDefined();
    const dup = await admin.post('/api/usuarios').set(CABECERA).send({ nombre: 'Otro', correo: 'PA@prueba.test', contrasena: 'ClaveSegura123', rol: 'COORDINADOR' });
    expect(dup.status).toBe(409);
  });

  it('el administrador no puede desactivarse a sí mismo', async () => {
    const admin = await sesion('admin@prueba.test');
    const yo = await admin.get('/api/auth/me');
    expect((await admin.patch(`/api/usuarios/${yo.body.usuario.id}`).set(CABECERA).send({ activo: false })).status).toBe(409);
  });
});

describe('T03 · Productores (RF-03)', () => {
  it('el administrador registra un productor con su vereda y coordinación lo consulta', async () => {
    const admin = await sesion('admin@prueba.test');
    const r = await admin.post('/api/usuarios').set(CABECERA).send({
      nombre: 'Productor C',
      correo: 'pc@prueba.test',
      contrasena: 'ClaveSegura123',
      rol: 'PRODUCTOR',
      vereda: 'Vereda Tres',
    });
    expect(r.status).toBe(201);
    expect(r.body.vereda).toBe('Vereda Tres');
    const coord = await sesion('coord@prueba.test');
    const lista = await coord.get('/api/productores?q=Productor C');
    expect(lista.body.datos).toHaveLength(1);
  });

  it('exige vereda para cuentas de productor', async () => {
    const admin = await sesion('admin@prueba.test');
    const r = await admin.post('/api/usuarios').set(CABECERA).send({ nombre: 'Sin Vereda', correo: 'sv@prueba.test', contrasena: 'ClaveSegura123', rol: 'PRODUCTOR' });
    expect(r.status).toBe(422);
    expect(r.body.error.campos.vereda).toBeDefined();
  });

  it('el productor consulta y actualiza solo su propio perfil', async () => {
    const pa = await sesion('pa@prueba.test');
    const r = await pa.patch('/api/productores/me').set(CABECERA).send({ telefono: '3109998877' });
    expect(r.status).toBe(200);
    expect(r.body.telefono).toBe('3109998877');
    expect((await pa.patch(`/api/productores/${r.body.id}`).set(CABECERA).send({ vereda: 'Otra' })).status).toBe(403);
  });
});

describe('T04 · Catálogo de productos (RF-04)', () => {
  it('lista solo productos activos para los usuarios', async () => {
    const pa = await sesion('pa@prueba.test');
    const r = await pa.get('/api/productos');
    const nombres = r.body.datos.map((p: { nombre: string }) => p.nombre);
    expect(nombres).toContain('Plátano');
    expect(nombres).not.toContain('Producto retirado');
  });

  it('el administrador agrega un producto con unidades coherentes', async () => {
    const admin = await sesion('admin@prueba.test');
    const ok = await admin.post('/api/productos').set(CABECERA).send({ nombre: 'Yuca', unidades: ['Bultos', 'kilogramos'], unidad_defecto: 'bultos' });
    expect(ok.status).toBe(201);
    expect(ok.body.unidades).toEqual(['bultos', 'kilogramos']);
    const mal = await admin.post('/api/productos').set(CABECERA).send({ nombre: 'Maíz', unidades: ['bultos'], unidad_defecto: 'toneladas' });
    expect(mal.status).toBe(422);
    const dup = await admin.post('/api/productos').set(CABECERA).send({ nombre: 'yuca', unidades: ['bultos'], unidad_defecto: 'bultos' });
    expect(dup.status).toBe(409);
  });

  it('un producto inactivo no se puede seleccionar en una solicitud', async () => {
    const admin = await sesion('admin@prueba.test');
    const todos = await admin.get('/api/productos?incluirInactivos=true');
    const retirado = todos.body.datos.find((p: { nombre: string }) => p.nombre === 'Producto retirado');
    const pa = await sesion('pa@prueba.test');
    const r = await pa.post('/api/solicitudes').set(CABECERA).send({
      producto_id: retirado.id,
      cantidad: 3,
      unidad: 'bultos',
      ubicacion_texto: 'Vereda Uno, referencia',
      fecha_disponible: enDias(1),
    });
    expect(r.status).toBe(422);
    expect(r.body.error.campos.producto_id).toBeDefined();
    expect(await productoId(pa, 'Producto retirado')).toBeUndefined();
  });
});
