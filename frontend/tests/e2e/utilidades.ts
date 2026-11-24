import { expect, type Page } from '@playwright/test';

export const CONTRASENA = process.env.E2E_CONTRASENA ?? 'Prueba2026local';
export const CUENTAS = {
  productor: 'productor.a@agroturno.test',
  coordinador: 'coordinador@agroturno.test',
  admin: 'admin@agroturno.test',
};

export async function ingresar(page: Page, correo: string) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña').fill(CONTRASENA);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/app\/inicio/);
}

/** Fecha AAAA-MM-DD en Arauquita dentro de n días */
export function enDias(n: number) {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const d = new Date(`${hoy}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** En móvil el menú está plegado: lo abre si hace falta */
export async function irA(page: Page, enlace: string) {
  await expect(page.getByRole('banner')).toBeVisible();
  const destino = page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: enlace, exact: true });
  if ((page.viewportSize()?.width ?? 1024) <= 768) {
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    await expect(destino).toBeVisible();
  }
  await destino.click();
}
