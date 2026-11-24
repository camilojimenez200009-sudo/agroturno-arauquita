import { defineConfig, devices } from '@playwright/test';

// Pruebas extremo a extremo sobre la base local con datos ficticios (npm run db:semilla).
// Navegadores: `npx playwright install chromium firefox webkit`. Para Chromium también se puede usar
// Chrome del sistema definiendo CHROME_PATH (por ejemplo /usr/bin/google-chrome).
const ejecutable = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BASE,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 }, launchOptions: ejecutable } },
    { name: 'movil', use: { ...devices['Pixel 7'], launchOptions: ejecutable } },
    // T13 · Compatibilidad con otros motores: Firefox (Gecko) y Safari (WebKit)
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1366, height: 860 } } },
    { name: 'safari-iphone', use: { ...devices['iPhone 13'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        { command: 'npm --prefix ../backend start', url: 'http://localhost:3000/api/health', reuseExistingServer: true, timeout: 60_000 },
        { command: 'npx vite --port 5173', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 },
      ],
});
