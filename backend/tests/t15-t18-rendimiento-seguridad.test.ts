import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cerrarPool } from '../src/db/pool';
import { CABECERA, app, crearSolicitud, enDias, sesion } from './utilidades';

afterAll(() => cerrarPool());

describe('T15 · Rendimiento de consultas simples (meta de referencia: 3 s)', () => {
  beforeAll(async () => {
    // Carga 500 solicitudes ficticias adicionales para medir con más volumen
    const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL_ADMIN });
    await db.connect();
    await db.query(`
      INSERT INTO agroturno.solicitudes (productor_id, producto_id, cantidad, unidad, ubicacion_texto, fecha_disponible, creado_por)
      SELECT p.id, pr.id, (random() * 100 + 1)::numeric(12,2), 'racimos', 'Vereda de carga ' || g, current_date + (g % 60), p.usuario_id
        FROM generate_series(1, 500) g,
             (SELECT id, usuario_id FROM agroturno.productores ORDER BY nombre_publico LIMIT 1) p,
             (SELECT id FROM agroturno.productos WHERE nombre = 'Plátano') pr`);
    await db.end();
  });

  it('listado, filtro combinado y resumen responden por debajo de la meta', async () => {
    const c = await sesion('coord@prueba.test');
    const mediciones: Record<string, number> = {};
    for (const [nombre, ruta] of [
      ['listado', '/api/solicitudes?tamano=20'],
      ['filtro combinado', `/api/solicitudes?estado=PENDIENTE&desde=${enDias(0)}&hasta=${enDias(30)}&q=Vereda`],
      ['resumen', '/api/solicitudes/resumen'],
    ] as const) {
      const inicio = performance.now();
      const r = await c.get(ruta);
      mediciones[nombre] = Math.round(performance.now() - inicio);
      expect(r.status).toBe(200);
    }
    console.info('[T15] tiempos (ms):', mediciones);
    for (const ms of Object.values(mediciones)) expect(ms).toBeLessThan(3000);
  });
});

describe('T18 · Seguridad', () => {
  it('trata entradas con caracteres especiales como datos, no como SQL', async () => {
    const c = await sesion('coord@prueba.test');
    const ataque = "x' OR '1'='1'; DROP TABLE agroturno.solicitudes; --";
    const r = await c.get(`/api/solicitudes?q=${encodeURIComponent(ataque)}`);
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(0);
    const pa = await sesion('pa@prueba.test');
    const s = await crearSolicitud(pa, { notas: "<script>alert('x')</script> O'Brien" });
    expect(s.notas).toBe("<script>alert('x')</script> O'Brien");
    expect((await c.get('/api/solicitudes/resumen')).status).toBe(200);
  });

  it('rechaza peticiones que modifican datos sin la cabecera anti-CSRF o desde otro origen', async () => {
    const pa = await sesion('pa@prueba.test');
    expect((await pa.post('/api/solicitudes').send({})).status).toBe(403);
    expect((await pa.post('/api/solicitudes').set(CABECERA).set('Origin', 'https://sitio-malicioso.example').send({})).status).toBe(403);
  });

  it('una sesión vencida deja de ser válida', async () => {
    const pb = await sesion('pb@prueba.test');
    const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL_ADMIN });
    await db.connect();
    await db.query(
      `UPDATE agroturno.sesiones SET expira_en = now() - interval '1 minute'
        WHERE usuario_id = (SELECT id FROM agroturno.usuarios WHERE correo = 'pb@prueba.test')`,
    );
    await db.end();
    expect((await pb.get('/api/auth/me')).status).toBe(401);
  });

  it('una cookie inventada no da acceso', async () => {
    const r = await request(app).get('/api/auth/me').set('Cookie', 'agroturno_sesion=token-inventado');
    expect(r.status).toBe(401);
  });

  it('las contraseñas y los tokens se guardan solo como hash', async () => {
    const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL_ADMIN });
    await db.connect();
    const u = await db.query("SELECT hash_contrasena FROM agroturno.usuarios WHERE correo = 'pa@prueba.test'");
    const s = await db.query('SELECT token_hash FROM agroturno.sesiones LIMIT 1');
    await db.end();
    expect(u.rows[0].hash_contrasena).toMatch(/^\$2[aby]\$/);
    expect(s.rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('responde con cabeceras de seguridad y sin caché en la API', async () => {
    const r = await request(app).get('/api/health');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['content-security-policy']).toBeDefined();
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['x-powered-by']).toBeUndefined();
    expect(r.body).toEqual({ estado: 'ok', base_de_datos: 'ok', latencia_ms: expect.any(Number) });
  });

  it('un identificador mal formado no revela detalles internos', async () => {
    const pa = await sesion('pa@prueba.test');
    const r = await pa.get('/api/solicitudes/1%20OR%201=1');
    expect(r.status).toBe(404);
    expect(JSON.stringify(r.body)).not.toMatch(/sql|syntax|postgres/i);
  });
});
