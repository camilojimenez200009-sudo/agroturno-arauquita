import pg from 'pg';
import { config } from '../config';

// Las columnas DATE se conservan como texto AAAA-MM-DD para no desplazar el día por zona horaria
pg.types.setTypeParser(1082, (valor) => valor);
// NUMERIC llega como texto; las cantidades del prototipo caben en un número JS
pg.types.setTypeParser(1700, (valor) => Number(valor));
// BIGINT (ids de historial y conteos)
pg.types.setTypeParser(20, (valor) => Number(valor));

let pool: pg.Pool | null = null;

export function obtenerPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: config.databaseUrl,
      max: config.dbMaxConexiones,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
      ssl: config.dbSsl ? { rejectUnauthorized: false } : undefined,
    });
    pool.on('error', (error) => {
      console.error('[db] error inesperado en una conexión inactiva', error.message);
    });
  }
  return pool;
}

export type Consultor = Pick<pg.PoolClient, 'query'>;

export function consulta<T extends pg.QueryResultRow = pg.QueryResultRow>(texto: string, valores: unknown[] = []) {
  return obtenerPool().query<T>(texto, valores);
}

/**
 * Ejecuta varias operaciones en una única transacción.
 * Si la función lanza un error se hace ROLLBACK y el error se propaga.
 */
export async function transaccion<T>(trabajo: (cliente: pg.PoolClient) => Promise<T>): Promise<T> {
  const cliente = await obtenerPool().connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await trabajo(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    cliente.release();
  }
}

export async function cerrarPool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
