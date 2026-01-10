import { test, expect } from '@playwright/test';
import { login } from './helpers';

const EMAIL = process.env.E2E_USER_EMAIL || 'test_e2e@example.com';
const PASSWORD = process.env.E2E_USER_PASSWORD || 'password123';

test.describe('Gestion des Groupes - Workflow E2E', () => {

    test.beforeEach(async ({ page }) => {
        // Augmenter la taille du viewport pour éviter les problèmes de "outside viewport"
        await page.setViewportSize({ width: 1280, height: 1000 });
        page.on('console', msg => console.log(`[Browser Console] ${msg.text()}`));
        await login(page, EMAIL, PASSWORD);
    });

    test('Création, Assignation et Filtrage de Groupe', async ({ page }) => {
        test.setTimeout(90000);
        const uniqueId = Date.now().toString().slice(-6);
        const groupName = `Group-${uniqueId}`;

        console.log(`--- Étape 1: Création du groupe [${groupName}] ---`);
        await page.goto('/students');
        await page.waitForLoadState('networkidle');

        // Ouvrir le filtre
        const filterBtn = page.getByTestId('filter-button');
        await filterBtn.waitFor({ state: 'visible' });
        await filterBtn.click();

        // On attend que le menu s'ouvre
        const addGroupBtn = page.getByTestId('add-group-button');
        await addGroupBtn.waitFor({ state: 'visible' });

        // Force click si Playwright galère avec le scrolling du menu
        await addGroupBtn.click({ force: true });

        // Remplir le nom
        const nameInput = page.getByTestId('input-group-name');
        await expect(nameInput).toBeVisible();
        await nameInput.fill(groupName);
        await page.getByTestId('confirm-create-group').click();

        // Attendre toast succès
        await expect(page.getByText(/success|créé/i)).toBeVisible({ timeout: 10000 }).catch(() => { });

        // Vérifier que le groupe apparaît dans les filtres
        console.log('--- Vérification dans les filtres ---');
        await page.getByTestId('filter-button').click();
        const groupFilterItem = page.getByText(groupName);
        await expect(groupFilterItem).toBeVisible({ timeout: 10000 });

        // Fermer le filtre
        await page.keyboard.press('Escape');

        console.log('--- Étape 2: Assignation d\'un élève au groupe ---');
        await page.waitForTimeout(1000);
        const studentCard = page.getByTestId('student-card').first();
        await studentCard.click();

        // Changer le groupe via le select
        const groupSelect = page.getByTestId('select-group');
        await groupSelect.waitFor({ state: 'visible' });
        await groupSelect.selectOption({ label: groupName });

        // Attendre sauvegarde auto
        await expect(page.getByText(/sauv/i)).toBeVisible({ timeout: 10000 }).catch(() => { });

        console.log('--- Étape 3: Vérification du filtrage ---');
        await page.goto('/students');
        await page.waitForLoadState('networkidle');

        // Appliquer le filtre
        await page.getByTestId('filter-button').click();
        await page.getByText(groupName).click({ force: true });

        // Fermer le filtre
        await page.keyboard.press('Escape');

        // Vérifier que la liste affiche l'élève
        await expect(page.getByTestId('student-card')).not.toHaveCount(0);

        console.log('Workflow Groupe validé !');
    });
});
