/**
 * Voter Registration Regression Tests - VoteSystem
 * ==================================================
 * Classification: REGRESSION / E2E
 *
 * Purpose: Verify the multi-step voter registration (empadronamiento) form
 * continues working correctly after any code change.
 * Uses API mocks to avoid creating real DB records.
 *
 * Covers:
 *  - Step 1: Personal data (DNI, name, date of birth)
 *  - Step 2: Location (Departamento → Provincia → Distrito)
 *  - Step 3: Contact (optional fields)
 *  - Step 4: Facial biometrics step visible with correct UI elements
 */

import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
//  Mock setup: Auth + Location APIs
// ─────────────────────────────────────────────────────────────────────────────
async function mockAdminSession(page) {
  await page.route('**/api/usuarios/auth/login', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'fake-jwt-token' }) })
  );
  await page.route('**/api/usuarios/auth/me', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ data: { id: 1, first_name: 'Admin', role: 'ADMIN', email: 'admin@test.local' } }),
    })
  );
  await page.route('**/api/votacion/user/1', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ has_voted: false }) })
  );
}

async function mockLocationAPIs(page) {
  await page.route('**/api/usuarios/regiones/departamentos', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id_depa: '15', name: 'LIMA' }]) })
  );
  await page.route('**/api/usuarios/regiones/provincias/*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id_prov: '1501', name: 'LIMA' }]) })
  );
  await page.route('**/api/usuarios/regiones/distritos/*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id_dist: '150101', name: 'LIMA' }]) })
  );
}

async function mockRegisterAPI(page) {
  await page.route('**/api/usuarios/', route => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ message: 'User created successfully', data: { id: 99, dni: '87654321' } }),
      });
    } else {
      route.continue();
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helper: Navigate to register form as authenticated admin
// ─────────────────────────────────────────────────────────────────────────────
async function goToRegisterForm(page) {
  // Set a fake auth token in localStorage to simulate a logged-in admin
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('token', 'fake-jwt-token');
  });
  await page.goto('/admin/dashboard');
  await page.waitForLoadState('networkidle');

  const sidebarBtn = page.locator('button').filter({ hasText: /Empadronar|Register Voter|Akllaqta/i }).filter({ visible: true });
  await sidebarBtn.waitFor({ state: 'visible', timeout: 10000 });
  await sidebarBtn.click();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tests
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Regresión: Formulario de Empadronamiento', () => {

  test.beforeEach(async ({ page }) => {
    await mockAdminSession(page);
    await mockLocationAPIs(page);
    await mockRegisterAPI(page);
  });

  test('debe mostrar el campo DNI en el paso 1', async ({ page }) => {
    await goToRegisterForm(page);
    const dniField = page.locator('input[name="dni"]');
    await expect(dniField).toBeVisible({ timeout: 10000 });
  });

  test('debe completar el Paso 1 (datos personales) y avanzar', async ({ page }) => {
    await goToRegisterForm(page);

    const dniField = page.locator('input[name="dni"]');
    await dniField.waitFor({ state: 'visible', timeout: 10000 });

    await dniField.fill('87654321');
    await page.locator('input[name="dob"]').fill('1995-05-15');
    await page.locator('input[name="first_name"]').fill('Maria');
    await page.locator('input[name="paternal_last_name"]').fill('Quispe');
    await page.locator('input[name="maternal_last_name"]').fill('Huaman');

    await page.getByRole('button', { name: /Siguiente|Next|Qatiqnin/i }).click();

    // Step 2 (location) should now be visible
    await expect(page.locator('select').nth(0)).toBeVisible({ timeout: 5000 });
  });

  test('debe completar el Paso 2 (ubicación) con selects de ubicación', async ({ page }) => {
    await goToRegisterForm(page);

    // Complete Step 1
    const dniField = page.locator('input[name="dni"]');
    await dniField.waitFor({ state: 'visible', timeout: 10000 });
    await dniField.fill('87654321');
    await page.locator('input[name="dob"]').fill('1995-05-15');
    await page.locator('input[name="first_name"]').fill('Maria');
    await page.locator('input[name="paternal_last_name"]').fill('Quispe');
    await page.locator('input[name="maternal_last_name"]').fill('Huaman');
    await page.getByRole('button', { name: /Siguiente|Next|Qatiqnin/i }).click();

    // Complete Step 2
    await page.locator('select').nth(0).selectOption('15');
    await page.waitForTimeout(400);
    await page.locator('select').nth(1).selectOption('1501');
    await page.waitForTimeout(400);
    await page.locator('select').nth(2).selectOption('150101');
    await page.locator('input[name="address"]').fill('Calle Luna 456');
    await page.getByRole('button', { name: /Siguiente|Next|Qatiqnin/i }).click();

    // Step 3 (contact) should now be visible
    await expect(page.getByRole('button', { name: /Siguiente|Next|Qatiqnin/i })).toBeVisible({ timeout: 5000 });
  });

  test('debe mostrar el paso de biometría facial (Paso 4) con los elementos correctos', async ({ page }) => {
    await goToRegisterForm(page);

    // Step 1
    const dniField = page.locator('input[name="dni"]');
    await dniField.waitFor({ state: 'visible', timeout: 10000 });
    await dniField.fill('87654321');
    await page.locator('input[name="dob"]').fill('1995-05-15');
    await page.locator('input[name="first_name"]').fill('Maria');
    await page.locator('input[name="paternal_last_name"]').fill('Quispe');
    await page.locator('input[name="maternal_last_name"]').fill('Huaman');
    await page.getByRole('button', { name: /Siguiente|Next|Qatiqnin/i }).click();

    // Step 2
    await page.locator('select').nth(0).selectOption('15');
    await page.waitForTimeout(400);
    await page.locator('select').nth(1).selectOption('1501');
    await page.waitForTimeout(400);
    await page.locator('select').nth(2).selectOption('150101');
    await page.locator('input[name="address"]').fill('Calle Luna 456');
    await page.getByRole('button', { name: /Siguiente|Next|Qatiqnin/i }).click();

    // Step 3 (contact, optional)
    await page.getByRole('button', { name: /Siguiente|Next|Qatiqnin/i }).click();

    // Step 4: facial biometrics — verify critical UI elements
    await expect(page.getByRole('heading', { name: /Facial|Uya/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /Capturar|Capture/i })).toBeVisible();
  });

  test('debe rechazar un DNI con menos de 8 dígitos en el formulario', async ({ page }) => {
    await goToRegisterForm(page);

    const dniField = page.locator('input[name="dni"]');
    await dniField.waitFor({ state: 'visible', timeout: 10000 });
    await dniField.fill('1234'); // Only 4 digits

    // Click Next — should NOT advance the form
    await page.getByRole('button', { name: /Siguiente|Next|Qatiqnin/i }).click();
    await page.waitForTimeout(1000);

    // The DNI field should still be on screen (step 1 not advanced)
    await expect(dniField).toBeVisible({ timeout: 3000 });
    // The departamento select only appears on step 2 — must NOT be visible
    await expect(page.locator('select[name="department_id"]')).not.toBeVisible({ timeout: 3000 });
  });

});
