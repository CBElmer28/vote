/**
 * Voting Flow Regression Tests - VoteSystem
 * ==========================================
 * Classification: REGRESSION / E2E
 *
 * Purpose: Verify the core voting flow (DNI entry → voter screen → vote selection)
 * continues working correctly after any code change.
 * Uses API mocks to avoid real DB votes.
 *
 * Covers:
 *  - Voter DNI entry screen renders correctly
 *  - Voter proceeds to vote selection
 *  - Candidate cards are displayed
 *  - Vote confirmation dialog appears
 */

import { test, expect } from '@playwright/test';

async function mockVoterSession(page, dni = '12345678', hasVoted = false) {
  // Mock the login/identity check
  await page.route('**/api/usuarios/auth/login', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'fake-voter-token' }) })
  );
  await page.route('**/api/usuarios/auth/me', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        data: { id: 5, first_name: 'Voter', last_name: 'Test', role: 'VOTER', dni }
      }),
    })
  );
  // User voting status
  await page.route('**/api/votacion/user/5', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ has_voted: hasVoted }) })
  );
  // Mock candidates list
  await page.route('**/api/candidatos/*', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 1, full_name: 'Candidato Alpha', party: 'Partido A', is_active: true },
          { id: 2, full_name: 'Candidato Beta', party: 'Partido B', is_active: true },
        ],
        total: 2
      }),
    })
  );
  // Mock vote submission
  await page.route('**/api/votacion/', route => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ message: 'Voto registrado con éxito', data: { id: 100 } }),
      });
    } else {
      route.continue();
    }
  });
}

test.describe('Regresión: Flujo de Votación', () => {

  test.beforeEach(async ({ page }) => {
    await mockVoterSession(page);
  });

  test('la pantalla de entrada de DNI debe cargarse correctamente', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // DNI input should be present on the landing/voting entry screen
    const dniInput = page.locator('input[name="identifier"]').first();
    await expect(dniInput).toBeVisible({ timeout: 8000 });
  });

  test('los candidatos deben mostrarse en la pantalla de votación', async ({ page }) => {
    // Navigate directly to the voting screen simulating a logged-in voter
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-voter-token');
    });
    await page.goto('/vote');
    await page.waitForLoadState('networkidle');

    // Candidate names should appear (from mock)
    await expect(page.getByText(/Candidato Alpha/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/Candidato Beta/i)).toBeVisible({ timeout: 8000 });
  });

  test('debe permitir seleccionar un candidato y emitir el voto exitosamente', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-voter-token');
    });
    await page.goto('/vote');
    await page.waitForLoadState('networkidle');

    // Click on Candidate Alpha
    await page.getByText(/Candidato Alpha/i).click();

    // Click on Confirm button (wait for it to become enabled after selection)
    const confirmBtn = page.getByRole('button', { name: /Confirmar mi voto|Confirm/i });
    await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
    await confirmBtn.click();

    // Should redirect to results page
    await page.waitForURL(/\/results/, { timeout: 8000 });
    await expect(page).toHaveURL(/\/results/);
  });

  test('debe redirigir directamente a la vista de resultados si el usuario ya votó', async ({ page }) => {
    // Override the mock for this specific test
    await mockVoterSession(page, '12345678', true); // hasVoted = true

    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-voter-token');
    });
    // Attempt to access the voting page
    await page.goto('/vote');
    
    // Should immediately bounce to results
    await page.waitForURL(/\/results/, { timeout: 8000 });
    await expect(page).toHaveURL(/\/results/);
  });

});
