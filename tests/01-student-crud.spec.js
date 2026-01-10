import { test, expect } from '@playwright/test';
import { login } from './helpers';

// Credentials de test (à configurer dans .env ou secrets GitHub)
const EMAIL = process.env.E2E_USER_EMAIL || 'test_e2e@example.com';
const PASSWORD = process.env.E2E_USER_PASSWORD || 'password123';

test.describe('Gestion Étudiants', () => {

    test.beforeEach(async ({ page }) => {
        // Login
        await login(page, EMAIL, PASSWORD);
    });

    test('Création d\'un nouvel élève', async ({ page }) => {
        // 1. Ouvrir le formulaire directement
        await page.goto('/students/add');

        // 2. Attendre que la page soit prête
        await page.waitForURL(/\/students\/add/);

        // Attendre explicitement un élément du formulaire
        await page.getByTestId('input-firstname').waitFor({ state: 'visible', timeout: 10000 });

        // Generate Unique Name
        const uniqueId = Date.now();
        const studentName = `Jean-Test ${uniqueId}`;

        // Remplir le formulaire
        await page.getByTestId('input-firstname').fill(studentName);
        await page.getByTestId('input-lastname').fill('Automated');

        // 3. Sauvegarder
        await page.getByTestId('submit-student').click();

        // 4. Validation redirection et présence (Exact Match)
        await expect(page).toHaveURL(/\/students\/?$/, { timeout: 15000 });

        // Rechercher l'étudiant créé
        await page.getByTestId('search-students').waitFor({ state: 'visible', timeout: 10000 });
        await page.getByTestId('search-students').fill(studentName);
        await expect(page.getByText(studentName)).toBeVisible();
    });
});
