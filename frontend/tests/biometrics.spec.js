import { test, expect } from '@playwright/test';

test.describe('Admin Biometric Registration Flow', () => {

  test.beforeEach(async ({ page }) => {
    // MOCK API: Auth
    await page.route('**/api/usuarios/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'fake-jwt-token' }),
      });
    });

    await page.route('**/api/usuarios/auth/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 1,
            first_name: 'Admin',
            last_name: 'Test',
            role: 'ADMIN',
            email: 'admin@test.local'
          }
        }),
      });
    });

    await page.route('**/api/votacion/user/1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ has_voted: false }),
      });
    });
    // MOCK API: User data by email (for admin login step)
    await page.route('**/api/usuarios/by-email/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: 1, aws_face_id: 'fake-face-id', first_name: 'Admin' }
        }),
      });
    });

    // MOCK API: Face verification
    await page.route('**/api/biometrico/verify/face', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ verified: true }),
      });
    });

    // MOCK API: Ubicaciones (para el paso 2)
    await page.route('**/api/usuarios/regiones/departamentos', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id_depa: '15', name: 'LIMA' }]),
      });
    });

    await page.route('**/api/usuarios/regiones/provincias/*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id_prov: '1501', name: 'LIMA' }]),
      });
    });

    await page.route('**/api/usuarios/regiones/distritos/*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id_dist: '150101', name: 'LIMA' }]),
      });
    });
  });

  test('debe realizar el flujo completo de empadronamiento hasta biometría', async ({ page }) => {
    // 1. LOGIN
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');
    
    // El campo puede tardar un poco por la animación animate-fade-in
    const emailInput = page.locator('input[name="identifier"]');
    await emailInput.waitFor({ state: 'visible' });
    await emailInput.fill('admin@test.local');
    
    await page.getByRole('button', { name: /Continuar|Continue|Yaykuy/i }).filter({ visible: true }).click(); 
    
    // PASO 2: Huella (usando mock)
    const scanFingerBtn = page.getByRole('button', { name: /Escanear Huella|Scan Fingerprint|Ruk'ana/i }).filter({ visible: true });
    await scanFingerBtn.waitFor({ state: 'visible' });
    await scanFingerBtn.click();

    // PASO 3: Rostro (usando mock de subida de archivo para evitar falta de webcam)
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
    
    // 2. DASHBOARD - IR A EMPADRONAMIENTO
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 15000 });
    
    // Buscar el botón por texto directamente, siendo más tolerante
    const sidebarBtn = page.locator('button').filter({ hasText: /Empadronar|Register Voter|Akllaqta/i }).filter({ visible: true });
    await sidebarBtn.waitFor({ state: 'visible' });
    await sidebarBtn.click();
    
    // Ahora el formulario debería estar visible
    const dniField = page.locator('input[name="dni"]');
    await dniField.waitFor({ state: 'visible' });
    await dniField.fill('87654321');
    await page.locator('input[name="dob"]').fill('1995-05-15');
    await page.locator('input[name="first_name"]').fill('Maria');
    await page.locator('input[name="paternal_last_name"]').fill('Quispe');
    await page.locator('input[name="maternal_last_name"]').fill('Huaman');
    
    await page.getByRole('button', { name: /Siguiente|Next|Qatiqnin/i }).click();

    // PASO 2: Ubicación
    await page.locator('select').nth(0).selectOption('15'); // LIMA
    await page.waitForTimeout(500);
    await page.locator('select').nth(1).selectOption('1501'); // LIMA
    await page.waitForTimeout(500);
    await page.locator('select').nth(2).selectOption('150101'); // LIMA
    
    await page.locator('input[name="address"]').fill('Calle Luna 456');
    await page.getByRole('button', { name: /Siguiente|Next|Qatiqnin/i }).click();

    // PASO 3: Contacto
    await page.getByRole('button', { name: /Siguiente|Next|Qatiqnin/i }).click();

    // PASO 4: Rostro (Validar UI) - Usamos getByRole para evitar ambigüedades con el h2 principal
    await expect(page.getByRole('heading', { name: /Facial|Uya/i })).toBeVisible();
    
    // En un entorno de test real, Playwright emularía la webcam. 
    // Aquí validamos que los elementos críticos de la UI estén presentes.
    await expect(page.getByRole('button', { name: /Capturar|Capture/i })).toBeVisible();
  });

});
