/**
 * Smoke Tests - VoteSystem
 * ========================
 * Classification: SMOKE / REGRESSION
 * 
 * Purpose: Verify the most fundamental UI elements are present and functional
 * after any deployment or code change. These run first — if they fail,
 * there's no point running deeper tests.
 *
 * Covers:
 *  - Page loads correctly
 *  - Language switching (ES/EN/QU)
 *  - Accessibility panel
 */

import { test, expect } from '@playwright/test';

test.describe('Smoke Tests - Voter System', () => {

  test('la página de login debe cargar correctamente', async ({ page }) => {
    await page.goto('/');
    const welcomeText = await page.locator('h1').textContent();
    expect(welcomeText?.length).toBeGreaterThan(0);
  });

  test('el cambio de idioma a Quechua debe mostrar textos traducidos', async ({ page }) => {
    await page.goto('/');

    const langTrigger = page.getByRole('button', { name: /Cambiar Idioma|Change Language|Llasp'ay/i }).filter({ visible: true }).first();
    await langTrigger.click();

    await page.getByRole('button', { name: /QUECHUA/i }).filter({ visible: true }).click();

    await expect(page.getByRole('button', { name: /Katipay/i })).toBeVisible();
  });

  test('el panel de accesibilidad debe abrirse', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('accessibility-trigger').first().click();
    await expect(page.getByText(/Perfiles de Daltonismo|Color Blindness Profiles|Kaymanta/i)).toBeVisible({ timeout: 5000 });
  });

});
