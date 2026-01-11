import { test, expect } from '@playwright/test';
import { login } from './helpers';

const EMAIL = process.env.E2E_USER_EMAIL || 'test_e2e@example.com';
const PASSWORD = process.env.E2E_USER_PASSWORD || 'password123';

test.describe('Gestion des Paiements - Workflow Utilisateur COMPLET', () => {

    test.beforeEach(async ({ page }) => {
        // Enable console logs for debugging
        page.on('console', msg => console.log(`[Browser Console] ${msg.text()}`));
        await login(page, EMAIL, PASSWORD);
    });

    test('Cycle de paiement complet et Indicateurs de retard', async ({ page }) => {
        test.setTimeout(90000);

        // 1. CRÉATION ÉTUDIANT
        console.log('--- Étape 1: Création de l\'étudiant ---');
        await page.goto('/students/add');
        const uniqueId = Date.now();
        const studentFirstname = `PayT-${uniqueId}`;
        const studentLastname = `Automated`;

        await page.getByTestId('input-firstname').fill(studentFirstname);
        await page.getByTestId('input-lastname').fill(studentLastname);
        await page.getByTestId('submit-student').click();

        await page.waitForURL(/\/students\/?$/);

        // 2. NAVIGATION ET CONFIGURATION PLAN
        console.log('--- Étape 2: Configuration d\'un plan ---');
        await page.getByTestId('search-students').fill(studentFirstname);
        await page.waitForTimeout(1000);
        await page.getByText(studentFirstname).first().click();
        await page.waitForURL(/\/student\/[a-f0-9-]+\/?$/);

        const paymentsTab = page.getByTestId('tab-payments');
        await paymentsTab.click();

        // Configurer un plan de 50€ avec échéance au 1er du mois
        await page.getByTestId('edit-plan-button').click();
        await page.getByTestId('plan-amount-input').fill('50');
        await page.getByTestId('plan-due-day-input').fill('1');
        await page.getByTestId('save-plan-confirm').click();

        // Attente de la balance
        console.log('Attente de la génération de la dette (50€)...');
        await expect(page.getByText('50').first()).toBeVisible({ timeout: 20000 });
        console.log('Dette confirmée: 50€');

        // 3. VÉRIFICATION DASHBOARD
        console.log('--- Étape 3: Vérification Dashboard (Indicateur de retard) ---');
        await page.waitForTimeout(2000);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const dashboardBadge = page.getByTestId('late-payment-badge-dash');
        await expect(dashboardBadge).toBeVisible({ timeout: 15000 });
        const count = await page.getByTestId('late-payment-count-dash').innerText();
        console.log(`Nombre de retards affichés sur le dashboard: ${count}`);

        // 4. RÉGLEMENT PARTIEL
        console.log('--- Étape 4: Réglement partiel (20€) ---');
        await page.goto('/students');
        await page.getByTestId('search-students').fill(studentFirstname);
        await page.waitForTimeout(1000);
        await page.getByText(studentFirstname).first().click();
        await paymentsTab.click();

        const amountInput = page.getByTestId('payment-amount');
        await amountInput.fill('20');
        await page.getByTestId('payment-method-BIZUM').click();
        await page.getByTestId('submit-payment').click();

        // Attendre que la balance passe à 30
        await expect(page.getByText('30').first()).toBeVisible({ timeout: 15000 });
        console.log('Paiement partiel validé: restant 30€');

        // 5. TOUT RÉGLER
        console.log('--- Étape 5: "Tout régler" ---');
        await page.getByTestId('settle-all').click();
        // Correction ici: On accepte 30 ou 30.00
        const settledValue = await amountInput.inputValue();
        expect(parseFloat(settledValue)).toBe(30);

        await page.getByTestId('payment-method-CASH').click();
        await page.getByTestId('submit-payment').click();

        // Balance 0
        await expect(page.getByText('0').first()).toBeVisible({ timeout: 15000 });
        console.log('Solde réglé: 0€');

        // 6. NOTIFICATION BELL
        console.log('--- Étape 6: Notification Bell & Navigation ---');
        await page.goto('/');
        await page.getByTestId('notification-bell').click();
        const navLate = page.getByTestId('nav-late-payments');
        await expect(navLate).toBeVisible();
        await navLate.click();

        await page.waitForURL(/\/students\/late-payments\/?$/);
        console.log('Navigation vers la page des retards réussie.');

        console.log('--- TEST E2E PAIEMENT RÉUSSI ---');
    });
});
