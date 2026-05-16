/**
 * Auth Regression Tests - VoteSystem
 * =====================================
 * Classification: REGRESSION / E2E
 *
 * Purpose: Verify that the Admin authentication flow (Login → Dashboard)
 * continues working correctly after any code change.
 * Uses API mocks to isolate the UI from real backend state.
 *
 * Covers:
 *  - Admin login with email identifier
 *  - Fingerprint step (mocked)
 *  - Face verification step (mocked)
 *  - Successful redirect to /admin/dashboard
 */

import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
//  Shared mock setup
// ─────────────────────────────────────────────────────────────────────────────
function mockAuthAPIs(page) {
  return Promise.all([
    page.route('**/api/usuarios/auth/login', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'fake-jwt-token' }),
      })
    ),
    page.route('**/api/usuarios/auth/me', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 1,
            first_name: 'Admin',
            last_name: 'Test',
            role: 'ADMIN',
            email: 'admin@test.local',
            aws_face_id: 'fake-face-id',
            fingerprint_id: 'fake-fingerprint-id',
            fingerprint_template: [{ x: 10, y: 20, angle: 0.5, type: 1 }]
          }
        }),
      })
    ),
    page.route('**/api/votacion/user/1', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ has_voted: false }),
      })
    ),
    page.route('**/api/usuarios/by-email/**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 1,
            aws_face_id: 'fake-face-id',
            first_name: 'Admin',
            fingerprint_template: [{ x: 10, y: 20, angle: 0.5, type: 1 }]
          }
        }),
      })
    ),
    page.route('**/api/biometrico/verify/face', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ verified: true }),
      })
    ),
    // Mock fingerprint minutiae registration (called by 'Validar Huella')
    page.route('**/api/biometrico/register/fingerprint/minutiae', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Template de minucias generado correctamente',
          iso_template: [{ x: 10, y: 20, angle: 0.5, type: 1 }]
        }),
      })
    ),
    // Mock fingerprint minutiae verification
    page.route('**/api/biometrico/verify/fingerprint/minutiae', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ verified: true, score: 95.0, threshold: 45.0 }),
      })
    ),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tests
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Regresión: Flujo de Login del Admin', () => {

  test.beforeEach(async ({ page }) => {
    await mockAuthAPIs(page);
  });

  test('debe mostrar el formulario de login al navegar a /admin/login', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');
    const emailInput = page.locator('input[name="identifier"]');
    await expect(emailInput).toBeVisible();
  });

  test('debe completar el flujo de login hasta el dashboard', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');

    // Step 1: Enter email identifier
    const emailInput = page.locator('input[name="identifier"]');
    await emailInput.waitFor({ state: 'visible' });
    await emailInput.fill('admin@test.local');
    await page.getByRole('button', { name: /Continuar|Continue|Yaykuy/i }).filter({ visible: true }).click();

    // Step 2: Fingerprint — upload file and click validate
    const fingerLabel = page.locator('label').filter({ hasText: /Seleccionar/i }).first();
    await fingerLabel.waitFor({ state: 'visible', timeout: 15000 });
    const fingerFileChooserPromise = page.waitForEvent('filechooser');
    await fingerLabel.click();
    const fingerFileChooser = await fingerFileChooserPromise;
    await fingerFileChooser.setFiles({
      name: 'huella.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-fingerprint'),
    });
    const validateBtn = page.getByRole('button', { name: /Validar Huella|Validate Fingerprint/i });
    await validateBtn.waitFor({ state: 'visible', timeout: 10000 });
    await validateBtn.click();

    // Step 3: Face verification (mocked via file upload)
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('label').filter({ hasText: /Seleccionar|Select|Qillqay/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'face.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-content'),
    });

    const confirmBtn = page.getByRole('button', { name: /Confirmar y Continuar|Confirm and Continue|Allinmi/i }).filter({ visible: true });
    await confirmBtn.waitFor({ state: 'visible' });
    await confirmBtn.click();

    // Should land on admin dashboard
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test('no debe acceder al dashboard sin token', async ({ page }) => {
    // Navigate directly to protected route without auth
    await page.goto('/admin/dashboard');
    // Should be redirected away (to login or home)
    await page.waitForURL(url => !url.href.includes('/admin/dashboard'), { timeout: 5000 });
    expect(page.url()).not.toContain('/admin/dashboard');
  });

});
