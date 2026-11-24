import { expect, test } from '@playwright/test';
import { CUENTAS, enDias, ingresar, irA } from './utilidades';

// T05, T09, T11, T12 y T13 desde la interfaz: recorrido Ingreso → Solicitud → Programación → En proceso → Completada
test('recorrido completo de una solicitud entre productor y coordinador', async ({ browser }) => {
  test.setTimeout(90_000);
  // Cada actor usa su propio contexto con el mismo dispositivo del proyecto (escritorio o móvil)
  const opciones = { viewport: test.info().project.use.viewport, isMobile: test.info().project.use.isMobile, locale: 'es-CO' };
  const productor = await (await browser.newContext({ ...opciones, baseURL: test.info().project.use.baseURL })).newPage();
  await ingresar(productor, CUENTAS.productor);
  await productor.goto('/app/solicitudes/nueva');
  await productor.getByLabel('Producto').selectOption({ label: 'Plátano' });
  await productor.getByLabel('Cantidad').fill('38');
  await productor.getByLabel('Ubicación').fill('Vereda La Reinera, punto ficticio para prueba automatizada');
  await productor.getByLabel('Fecha disponible').fill(enDias(1));
  await productor.getByRole('button', { name: 'Registrar solicitud' }).click();
  await expect(productor.getByRole('heading', { name: 'Solicitud guardada con éxito' })).toBeVisible();
  const codigo = (await productor.locator('strong.codigo').first().textContent())!.trim();
  expect(codigo).toMatch(/^AT-\d{5}$/);

  const coordinador = await (await browser.newContext({ ...opciones, baseURL: test.info().project.use.baseURL })).newPage();
  await ingresar(coordinador, CUENTAS.coordinador);
  await irA(coordinador, 'Solicitudes');
  await coordinador.getByLabel(/Buscar código/).fill(codigo);
  await coordinador.getByRole('link', { name: `Ver detalle de ${codigo}` }).filter({ visible: true }).first().click();
  await coordinador.getByRole('button', { name: 'Programar' }).click();
  await coordinador.getByLabel('Fecha acordada').fill(enDias(2));
  await coordinador.getByLabel('Franja').selectOption('MANANA');
  await coordinador.getByRole('button', { name: 'Programar recolección' }).click();
  await expect(coordinador.getByText(`Solicitud ${codigo} programada.`)).toBeVisible();

  for (const [accion, estado] of [
    ['Iniciar recolección', 'En proceso'],
    ['Marcar como completada', 'Completada'],
  ]) {
    await coordinador.getByRole('button', { name: new RegExp(accion) }).first().click();
    await coordinador.getByRole('button', { name: 'Confirmar' }).click();
    await expect(coordinador.locator('h1 .estado')).toHaveText(estado);
  }

  // El productor consulta el historial completo de su solicitud
  await productor.getByRole('button', { name: 'Ver detalle' }).click();
  const historial = productor.getByRole('list', { name: 'Historial de la solicitud' });
  await expect(historial.getByRole('listitem')).toHaveCount(4);
  await expect(historial).toContainText('Solicitud registrada');
  await expect(historial).toContainText('Recolección programada');
  await expect(historial).toContainText('En proceso → Completada');
});

test('un productor que abre una sección de administración ve acceso denegado', async ({ page }) => {
  await ingresar(page, CUENTAS.productor);
  await page.goto('/app/usuarios');
  await expect(page.getByText('Acceso denegado (403)')).toBeVisible();
});
