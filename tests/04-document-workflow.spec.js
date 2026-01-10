import { test, expect } from '@playwright/test';
import { login } from './helpers';

const EMAIL = process.env.E2E_USER_EMAIL || 'test_e2e@example.com';
const PASSWORD = process.env.E2E_USER_PASSWORD || 'password123';

test.describe('Gestion des Documents - Workflow avec Mock Google Drive', () => {

    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log(`[Browser Console] ${msg.text()}`));
        await login(page, EMAIL, PASSWORD);

        // --- MOCK GOOGLE AUTH ---
        await page.evaluate(() => {
            localStorage.setItem('gdrive_token', 'mock-e2e-token');
            localStorage.setItem('gdrive_expiry', (Date.now() + 3600000).toString());
        });

        // --- MOCK GOOGLE DRIVE API ---
        await page.route('**', async route => {
            const url = route.request().url();
            const method = route.request().method();

            if (!url.includes('googleapis.com')) {
                return route.continue();
            }

            console.log(`[Mock API] >>> Intercepted: ${method} ${url}`);

            try {
                // 1. Recherche de fichier/dossier (findOrCreateFolder)
                if (url.includes('/drive/v3/files') && method === 'GET' && !url.includes('mock-file-id')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ files: [{ id: 'mock-folder-id', name: 'MockFolder' }] })
                    });
                }

                // 2. Initialisation Upload (POST upload/drive/v3/files)
                if (url.includes('/upload/drive/v3/files') && method === 'POST') {
                    return route.fulfill({
                        status: 200,
                        headers: {
                            'Location': 'https://www.googleapis.com/upload/mock-session-123',
                            'Access-Control-Expose-Headers': 'Location'
                        },
                        body: ''
                    });
                }

                // 3. Création de dossiers ou permissions (POST sans /upload/)
                if (url.includes('/drive/v3/files') && method === 'POST') {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ id: 'mock-new-folder-id' })
                    });
                }

                // 4. Upload effectif (PUT sur la session)
                if (url.includes('/upload/mock-session-123') && method === 'PUT') {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            id: 'mock-file-id',
                            name: 'test-doc.webp',
                            mimeType: 'image/webp'
                        })
                    });
                }

                // 5. Suppression (DELETE)
                if (url.includes('/drive/v3/files/mock-file-id') && method === 'DELETE') {
                    return route.fulfill({ status: 204 });
                }

                // Fallback (Fonts, etc.)
                return route.continue();
            } catch (e) {
                console.error(`[Mock API] ERROR: ${e.message}`);
                return route.abort();
            }
        });
    });

    test('Ajout et Suppression de document (Mocké)', async ({ page }) => {
        test.setTimeout(90000);

        // 1. Navigation vers un étudiant
        console.log('--- Étape 1: Navigation ---');
        await page.goto('/students');
        await page.waitForLoadState('networkidle');

        await page.waitForSelector('div[data-testid="student-card"]', { timeout: 15000 });
        const studentCard = page.getByTestId('student-card').first();
        await studentCard.click();

        // 2. Ouvrir l'onglet Documents
        console.log('--- Étape 2: Ouverture onglet Documents ---');
        const docsTab = page.getByTestId('tab-documents');
        await docsTab.waitFor({ state: 'visible', timeout: 15000 });
        await docsTab.click();

        // 3. Lancer l'ajout
        console.log('--- Étape 3: Simulation Upload ---');
        await page.getByTestId('add-document-button').click();

        const importBtn = page.getByTestId('choice-import-file');
        await expect(importBtn).toBeVisible({ timeout: 10000 });

        const fileChooserPromise = page.waitForEvent('filechooser');
        await importBtn.click();
        const fileChooser = await fileChooserPromise;

        await fileChooser.setFiles({
            name: 'test-document.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-image-content')
        });

        // 4. Configurer le nom dans la modal
        console.log('--- Étape 4: Modal de nommage ---');
        const nameInput = page.getByTestId('document-name-input');
        await expect(nameInput).toBeVisible({ timeout: 10000 });
        const docName = `Cert-E2E-${Date.now()}`;
        await nameInput.fill(docName);

        await page.getByTestId('document-type-button-sportLicense').click();
        await page.getByTestId('confirm-upload-button').click();

        // 5. Vérifier l'ajout
        console.log('--- Étape 5: Vérification ---');
        await expect(page.getByText(docName)).toBeVisible({ timeout: 30000 });
        console.log('Document ajouté avec succès !');

        // 6. Suppression
        console.log('--- Étape 6: Suppression ---');
        await page.getByTestId('delete-document-button').first().click();

        const confirmBtn = page.getByTestId('confirm-modal-confirm');
        await expect(confirmBtn).toBeVisible({ timeout: 10000 });
        await confirmBtn.click();

        await expect(page.getByText(docName)).not.toBeVisible({ timeout: 15000 });
        console.log('Document supprimé avec succès !');
    });
});
