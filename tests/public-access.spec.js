import { test, expect } from '@playwright/test';

test.describe('Public Navigation & Security (Non-Auth)', () => {

    test('Redirection vers Login si non authentifié', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveURL(/\/login/);
    });

    test('Page Login affiche DojoKai', async ({ page }) => {
        await page.goto('/login');
        await expect(page.getByRole('heading', { name: /DojoKai/i })).toBeVisible();
    });

    test('Tentative d\'accès direct à une route protégée redirige', async ({ page }) => {
        await page.goto('/students');
        await expect(page).toHaveURL(/\/login/);
    });

    test('Vérification des meta tags de base (SEO/PWA)', async ({ page }) => {
        await page.goto('/login');
        const title = await page.title();
        expect(title).toMatch(/DojoKai/);

        // Vérifier viewport pour mobile
        const viewportMeta = page.locator('meta[name="viewport"]');
        await expect(viewportMeta).toHaveAttribute('content', /width=device-width/);
    });
});
