function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}. Revisa backend/.env.example`);
  }
  return valor;
}

export const config = {
  get databaseUrl() {
    return requerida('DATABASE_URL');
  },
  produccion: process.env.NODE_ENV === 'production',
  prueba: process.env.NODE_ENV === 'test' || process.env.VITEST === 'true',
  /** Duración de la sesión en horas */
  horasSesion: Number(process.env.SESION_HORAS ?? 8),
  /** Usa TLS para la conexión a PostgreSQL (necesario en Supabase) */
  dbSsl: process.env.DB_SSL === 'true',
  /** Conexiones máximas por instancia; en funciones serverless conviene un valor bajo */
  dbMaxConexiones: Number(process.env.DB_MAX_CONEXIONES ?? 5),
  zonaHoraria: 'America/Bogota',
  nombreCookie: 'agroturno_sesion',
};
