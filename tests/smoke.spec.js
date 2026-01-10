import { test, expect } from '@playwright/test';

test('Page d\'accueil et Login accessible', async ({ page }) => {
    await page.goto('/');

    // Vérifie qu'on arrive bien (soit sur dashboard si déjà loggé, soit sur login)
    // Sur une fresh session, on doit être redirigé vers /login
    await expect(page).toHaveURL(/\/login/);

    // Vérifier la présence du bouton Google ou du Text
    await expect(page.getByText('DojoKai')).toBeVisible();
});
