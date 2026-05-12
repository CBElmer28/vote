import { test, expect } from '@playwright/test';

test.describe('Smoke Tests - Voter System', () => {
  
  test('debe cargar la página de login correctamente', async ({ page }) => {
    await page.goto('/');
    // Verificar que el título de bienvenida esté presente (en cualquier idioma)
    const welcomeText = await page.locator('h1').textContent();
    expect(welcomeText?.length).toBeGreaterThan(0);
  });

  test('debe funcionar el cambio de idioma a Quechua y mostrar textos traducidos', async ({ page }) => {
    await page.goto('/');
    
    // Abrir menú de idiomas
    const langTrigger = page.getByRole('button', { name: /Cambiar Idioma|Change Language|Llasp'ay/i }).filter({ visible: true }).first();
    await langTrigger.click();
    
    // Seleccionar Quechua en el menú
    await page.getByRole('button', { name: /QUECHUA/i }).filter({ visible: true }).click();
    
    // Verificar que el botón de login ahora diga "Katipay" (Katipay = Continuar)
    await expect(page.getByRole('button', { name: /Katipay/i })).toBeVisible();
  });

  test('debe mostrar el panel de accesibilidad', async ({ page }) => {
    await page.goto('/');
    
    // Abrir panel de accesibilidad usando el nuevo data-testid
    await page.getByTestId('accessibility-trigger').first().click();
    
    // Verificar que aparezca el menú de accesibilidad (buscando textos clave en cualquier idioma)
    await expect(page.getByText(/Perfiles de Daltonismo|Color Blindness Profiles|Kaymanta/i)).toBeVisible({ timeout: 5000 });
  });

});
