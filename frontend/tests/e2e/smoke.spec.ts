import { test, expect } from '@playwright/test';

test.describe('Smoke E2E', () => {
  test('@smoke loads "/" and shows app brand', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/verity news/i);
    await expect(page.getByRole('heading', { name: /verity news/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test('@smoke loads "/login" and shows auth form fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/);

    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/contrase|password/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /iniciar sesi|crear cuenta|procesando/i }).first()
    ).toBeVisible();
  });

  test('@smoke login page exposes stable actions', async ({ page }) => {
    await page.goto('/login');

    await expect(
      page.getByRole('button', { name: /continuar con google|conectando/i })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /volver al inicio/i })).toBeVisible();
  });
});

