import { defineConfig } from 'vitest/config';

// Base de pruebas aislada (nunca la base real). Se puede sobrescribir con variables de entorno.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://agroturno_app:dev_local_pw@localhost:5432/agroturno_test';
process.env.TEST_DATABASE_URL_ADMIN ??= 'postgres://postgres:postgres@localhost:5432/agroturno_test';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Las pruebas comparten una base de datos: se ejecutan en serie
    fileParallelism: false,
    globalSetup: ['tests/preparar-base.ts'],
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
