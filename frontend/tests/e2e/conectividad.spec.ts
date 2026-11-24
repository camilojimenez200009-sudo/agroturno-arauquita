import { expect, test } from '@playwright/test';
import { CUENTAS, enDias, ingresar } from './utilidades';

// T14 · Sin red o sin mapas, la interfaz informa el fallo y nunca confirma un guardado falso
test('si la API no responde al guardar, se informa el error y se conserva lo digitado', async ({ page }) => {
  await ingresar(page, CUENTAS.productor);
  await page.goto('/app/solicitudes/nueva');
  await page.getByLabel('Producto').selectOption({ label: 'Cacao' });
  await page.getByLabel('Cantidad').fill('60');
  await page.getByLabel('Ubicación').fill('Vereda La Reinera, referencia ficticia sin red');
  await page.getByLabel('Fecha disponible').fill(enDias(1));
  await page.route('**/api/solicitudes', (ruta) => (ruta.request().method() === 'POST' ? ruta.abort('internetdisconnected') : ruta.continue()));
  await page.getByRole('button', { name: 'Registrar solicitud' }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo conectar. Revisa tu conexión e inténtalo otra vez.');
  await expect(page.getByText('Solicitud guardada con éxito')).toHaveCount(0);
  await expect(page.getByLabel('Cantidad')).toHaveValue('60');
  await expect(page.getByLabel('Ubicación')).toHaveValue('Vereda La Reinera, referencia ficticia sin red');
});

test('sin conexión del navegador se muestra un aviso persistente', async ({ page, context }) => {
  await ingresar(page, CUENTAS.productor);
  await context.setOffline(true);
  await expect(page.getByText(/Sin conexión\. Puedes revisar lo que ya está en pantalla/)).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText(/Sin conexión\. Puedes revisar/)).toHaveCount(0);
});

test('si el servicio de mapas falla, la ubicación textual sigue disponible', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (r) => r.abort());
  await ingresar(page, CUENTAS.productor);
  await page.goto('/app/solicitudes/nueva');
  await page.getByRole('button', { name: 'Marcar en el mapa' }).click();
  await expect(page.getByText('El mapa no está disponible')).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('Producto').selectOption({ label: 'Yuca' });
  await page.getByLabel('Cantidad').fill('12');
  await page.getByLabel('Ubicación').fill('Vereda La Reinera, solo referencia textual');
  await page.getByLabel('Fecha disponible').fill(enDias(1));
  await page.getByRole('button', { name: 'Registrar solicitud' }).click();
  await expect(page.getByRole('heading', { name: 'Solicitud guardada con éxito' })).toBeVisible();
});
