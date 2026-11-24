// Aplica en orden los archivos de backend/db/migraciones que aún no se han ejecutado.
// Uso: npm run db:migrar   (requiere DATABASE_URL_ADMIN en backend/.env)
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL_ADMIN;
if (!url) {
  console.error('Define DATABASE_URL_ADMIN en backend/.env');
  process.exit(1);
}

const carpeta = path.resolve(__dirname, '../db/migraciones');
const cliente = new pg.Client({
  connectionString: url,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  await cliente.connect();
  await cliente.query(`CREATE TABLE IF NOT EXISTS public.agroturno_migraciones (
    archivo text PRIMARY KEY, aplicada_en timestamptz NOT NULL DEFAULT now())`);
  const { rows } = await cliente.query<{ archivo: string }>('SELECT archivo FROM public.agroturno_migraciones');
  const aplicadas = new Set(rows.map((r) => r.archivo));
  const archivos = (await readdir(carpeta)).filter((a) => a.endsWith('.sql')).sort();

  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) continue;
    const sql = await readFile(path.join(carpeta, archivo), 'utf8');
    process.stdout.write(`Aplicando ${archivo}... `);
    await cliente.query(sql);
    await cliente.query('INSERT INTO public.agroturno_migraciones (archivo) VALUES ($1)', [archivo]);
    console.log('listo');
  }
  console.log('Migraciones al día.');
}

main()
  .catch((error) => {
    console.error('\nError al migrar:', error.message);
    process.exitCode = 1;
  })
  .finally(() => cliente.end());
