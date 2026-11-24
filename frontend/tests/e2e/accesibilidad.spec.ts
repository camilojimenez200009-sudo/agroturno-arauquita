import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { CUENTAS, ingresar } from './utilidades';

// T17 · Etiquetas, teclado, foco visible, mensajes y contraste (WCAG 2.2 AA, revisión automatizada)
async function sinViolacionesGraves(page: import('@playwright/test').Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).exclude('.leaflet-container').analyze();
  const graves = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(graves.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

test('inicio de sesión operable solo con teclado', async ({ page }) => {
  await page.goto('/login');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Correo')).toBeFocused();
  await page.keyboard.type(CUENTAS.productor);
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Contraseña')).toBeFocused();
  await page.keyboard.type(process.env.E2E_CONTRASENA ?? 'Prueba2026local');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/app\/inicio/);
});

test('los errores de validación se anuncian junto a cada campo', async ({ page }) => {
  await ingresar(page, CUENTAS.productor);
  await page.goto('/app/solicitudes/nueva');
  await page.getByRole('button', { name: 'Registrar solicitud' }).click();
  const cantidad = page.getByLabel('Cantidad');
  await expect(cantidad).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Escribe la cantidad.')).toBeVisible();
  await expect(page.getByLabel('Producto')).toBeFocused();
});

for (const [nombre, ruta, cuenta] of [
  ['inicio de sesión', '/login', null],
  ['tablero del productor', '/app/inicio', CUENTAS.productor],
  ['nueva solicitud', '/app/solicitudes/nueva', CUENTAS.productor],
  ['tablero de coordinación', '/app/inicio', CUENTAS.coordinador],
  ['programación', '/app/programacion', CUENTAS.coordinador],
  ['usuarios', '/app/usuarios', CUENTAS.admin],
] as const) {
  test(`sin violaciones graves de accesibilidad: ${nombre}`, async ({ page }) => {
    if (cuenta) await ingresar(page, cuenta);
    await page.goto(ruta);
    await page.waitForLoadState('networkidle');
    await sinViolacionesGraves(page);
  });
}
