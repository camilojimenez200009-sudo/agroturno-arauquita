// Prepara una base de pruebas limpia: borra el esquema, aplica las migraciones
// y crea cuentas ficticias. Nunca debe apuntar a la base real.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import pg from 'pg';

export const CONTRASENA_PRUEBA = 'ClavePrueba2026';

export default async function () {
  const url = process.env.TEST_DATABASE_URL_ADMIN!;
  if (!/_test\b|_test$/.test(new URL(url).pathname)) {
    throw new Error('Por seguridad, la base de pruebas debe terminar en _test');
  }
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  await db.query('DROP SCHEMA IF EXISTS agroturno CASCADE');
  await db.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='agroturno_app') THEN CREATE ROLE agroturno_app LOGIN PASSWORD 'dev_local_pw'; END IF; END $$");
  const carpeta = path.resolve(__dirname, '../db/migraciones');
  for (const archivo of (await readdir(carpeta)).filter((a) => a.endsWith('.sql')).sort()) {
    await db.query(await readFile(path.join(carpeta, archivo), 'utf8'));
  }
  const hash = bcrypt.hashSync(CONTRASENA_PRUEBA, 4);
  const cuentas: Array<[string, string, string, string | null]> = [
    ['Admin Prueba', 'admin@prueba.test', 'ADMINISTRADOR', null],
    ['Coordinador Prueba', 'coord@prueba.test', 'COORDINADOR', null],
    ['Productor A', 'pa@prueba.test', 'PRODUCTOR', 'Vereda Uno'],
    ['Productor B', 'pb@prueba.test', 'PRODUCTOR', 'Vereda Dos'],
    ['Inactivo', 'inactivo@prueba.test', 'COORDINADOR', null],
  ];
  for (const [nombre, correo, rol, vereda] of cuentas) {
    const { rows } = await db.query(
      'INSERT INTO agroturno.usuarios (nombre, correo, hash_contrasena, rol, activo) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [nombre, correo, hash, rol, correo !== 'inactivo@prueba.test'],
    );
    if (vereda) {
      await db.query(
        'INSERT INTO agroturno.productores (usuario_id, nombre_publico, telefono, vereda) VALUES ($1,$2,$3,$4)',
        [rows[0].id, nombre, '3001112233', vereda],
      );
    }
  }
  await db.query(
    `INSERT INTO agroturno.productos (nombre, unidades, unidad_defecto, activo) VALUES
     ('Plátano', '{racimos,kilogramos}', 'racimos', true),
     ('Cacao', '{kilogramos,bultos}', 'kilogramos', true),
     ('Producto retirado', '{bultos}', 'bultos', false)`,
  );
  await db.end();
}
