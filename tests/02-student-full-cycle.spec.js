import { test, expect } from '@playwright/test';
import { login } from './helpers';

// Credentials de test (à configurer dans .env ou secrets GitHub)
const EMAIL = process.env.E2E_USER_EMAIL || 'test_e2e@example.com';
const PASSWORD = process.env.E2E_USER_PASSWORD || 'password123';

test.describe('Gestion Étudiants - Cycle Complet', () => {

    test.beforeEach(async ({ page }) => {
        // Login
        await login(page, EMAIL, PASSWORD);
    });

    test('Cycle de vie complet d\'un étudiant (CRUD)', async ({ page }) => {
        const uniqueId = Date.now();
        const studentFirstname = `Jean-Test-${uniqueId}`;
        const studentLastname = `Automated`;
        const editedFirstname = `${studentFirstname}-Edit`;

        // 1. CRÉATION
        console.log('--- Étape 1: Création ---');
        await page.goto('/students/add');
        await page.waitForURL(/\/students\/add/);

        await page.getByTestId('input-firstname').fill(studentFirstname);
        await page.getByTestId('input-lastname').fill(studentLastname);
        await page.getByTestId('submit-student').click();

        // Attendre le retour à la liste
        await expect(page).toHaveURL(/\/students\/?$/);

        // 2. RECHERCHE ET CONSULTATION
        console.log('--- Étape 2: Recherche et Consultation ---');
        await page.getByTestId('search-students').waitFor({ state: 'visible' });
        await page.getByTestId('search-students').fill(studentFirstname);

        // Cliquer sur la carte de l'étudiant
        const studentCard = page.getByText(studentFirstname);
        await expect(studentCard).toBeVisible();
        await studentCard.click();

        // Vérifier qu'on est sur la page de détails
        await expect(page).toHaveURL(/\/student\/[a-f0-9-]{36}/);

        // 3. ÉDITION
        console.log('--- Étape 3: Édition ---');
        await page.getByTestId('input-firstname').waitFor({ state: 'visible' });
        await page.getByTestId('input-firstname').fill(editedFirstname);

        // Cliquer sur Sauvegarder
        await page.getByTestId('save-student').click();

        // On attend que le bouton repasse en mode "Sauvegarder" après "Enregistrement..."
        // Ou on attend simplement un peu pour que l'auto-save/manual-save se termine
        await page.waitForTimeout(2000);

        // Retour à la liste via le bouton retour du header
        const backButton = page.getByTestId('back-button');
        await backButton.waitFor({ state: 'visible' });
        await backButton.click();

        // Wait for redirection
        await page.waitForURL(/\/students\/?$/);

        // 4. VÉRIFICATION ÉDITION
        console.log('--- Étape 4: Vérification Édition ---');
        await page.getByTestId('search-students').waitFor({ state: 'visible' });
        await page.getByTestId('search-students').fill(editedFirstname);
        await expect(page.getByText(editedFirstname)).toBeVisible();

        // 5. SUPPRESSION
        console.log('--- Étape 5: Suppression ---');
        await page.getByText(editedFirstname).click();
        await page.waitForURL(/\/student\/[a-f0-9-]{36}/);

        // Ouvrir le modal de suppression GLOBALE (pour nettoyer la base)
        const deleteButton = page.getByTestId('show-delete-modal');
        await deleteButton.scrollIntoViewIfNeeded();
        await deleteButton.click();

        // Confirmer dans le modal
        await page.getByTestId('confirm-delete').waitFor({ state: 'visible' });
        await page.getByTestId('confirm-delete').click();

        // Vérifier redirection finale
        await expect(page).toHaveURL(/\/students\/?$/);

        // Vérifier disparition
        await page.getByTestId('search-students').waitFor({ state: 'visible' });
        await page.getByTestId('search-students').fill(editedFirstname);
        await expect(page.getByText(editedFirstname)).not.toBeVisible();

        console.log('--- Test Cycle Complet Réussi ---');
    });
});
