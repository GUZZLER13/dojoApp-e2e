import { test, expect } from '@playwright/test';
import { login } from './helpers';

const EMAIL = process.env.E2E_USER_EMAIL || 'test_e2e@example.com';
const PASSWORD = process.env.E2E_USER_PASSWORD || 'password123';

test.describe('Payment Calculation Bug Regression', () => {
    let studentId;

    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
        // 1. Login (already ensures Dojo exists internally)
        await login(page, EMAIL, PASSWORD);
    });

    test('should correctly calculate and display quarterly payment amounts', async ({ page }) => {
        test.setTimeout(60000); // Increase timeout for the whole test
        const uniqueId = Date.now();
        const firstName = `BugFix`;
        const lastName = `Tester_${uniqueId}`;
        const fullName = `${firstName} ${lastName}`;

        // 1. Create a student
        console.log('[TEST] Navigating to /students/add to create student...');
        await page.goto('/students/add');
        console.log('[TEST] Filling first name:', firstName);
        await page.getByTestId('input-firstname').fill(firstName);
        await page.getByTestId('input-lastname').fill(lastName);
        // 2. Navigation redirects to student list
        console.log('[TEST] Checking submit button state...');
        const submitBtn = page.getByTestId('submit-student');
        await expect(submitBtn).toBeEnabled();
        console.log('[TEST] Clicking submit-student...');
        await submitBtn.click();

        console.log('[TEST] Waiting for redirection to /students...');
        await page.waitForURL(/\/students\/?$/, { timeout: 30000 });
        console.log('[TEST] Redirected to /students');

        // 3. Search and click for the student to go to detail view
        console.log('[TEST] Searching for student:', lastName);
        await page.getByTestId('search-students').waitFor({ state: 'visible' });
        await page.getByTestId('search-students').fill(lastName);

        console.log('[TEST] Waiting for student to appear in list...');
        const studentRow = page.getByText(fullName).first();
        await studentRow.waitFor({ state: 'visible', timeout: 10000 });

        console.log('[TEST] Clicking student row...');
        await studentRow.click();

        // 4. Wait for Student View
        console.log('[TEST] Waiting for student detail view...');
        await page.waitForURL(/\/student\/[a-f0-9-]{36}/, { timeout: 20000 });
        const url = page.url();
        studentId = url.split('/').pop();
        console.log('[TEST] Student Detail View loaded:', studentId);

        // 5. Go to Payments tab
        console.log('[TEST] Locating Payments tab...');
        const paymentsTab = page.getByTestId('tab-payments');

        console.log('[TEST] Scrolling to Payments tab and clicking...');
        await paymentsTab.scrollIntoViewIfNeeded();
        // Add a small delay for UI stability
        await page.waitForTimeout(500);
        await paymentsTab.click({ force: true });
        console.log('[TEST] Payments tab clicked.');

        // 6. Configure Quarterly Plan (30€ monthly base)
        console.log('[TEST] Locating Edit Plan button...');
        const editPlanBtn = page.getByTestId('edit-plan-button');
        await editPlanBtn.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        console.log('[TEST] Clicking Edit Plan button...');
        await editPlanBtn.click();

        // Select Quarterly
        console.log('[TEST] Selecting Quarterly frequency...');
        const quarterlyBtn = page.getByTestId('plan-freq-quarterly');
        await quarterlyBtn.click();

        // Fill 30€ (monthly base)
        console.log('[TEST] Filling monthly base amount (30€)...');
        const amountInput = page.getByTestId('plan-amount-input');
        await amountInput.fill('30', { timeout: 10000 });

        // Check real-time calculation in modal (30 * 3 = 90)
        console.log('[TEST] Checking quarterly calculation (should be 90€)...');
        const quarterlyCalc = page.getByTestId('quarterly-calculated-display');
        await expect(quarterlyCalc).toContainText('90€');
        console.log('[TEST] Quarterly calculation verified in modal.');

        // Save plan "Dès maintenant" (current month)
        console.log('[TEST] Selecting "Dès maintenant" and saving...');
        await page.getByTestId('apply-mode-current').click();
        await page.getByTestId('save-plan-confirm').click();
        console.log('[TEST] Plan saved.');

        // Verify the displayed amount in the summary card (should be 90€, not 270€)
        console.log('[TEST] Verifying plan amount display (90€) in summary...');
        const planDisplay = page.getByTestId('plan-amount-display');
        await expect(planDisplay).toContainText('90 €');
        console.log('[TEST] Plan summary amount verified.');

        // 7. Refresh to ensure backend logic synced correctly
        console.log('[TEST] Reloading page to verify backend sync...');
        await page.reload();
        await page.getByTestId('tab-payments').scrollIntoViewIfNeeded();
        await page.getByTestId('tab-payments').click({ force: true });

        // 8. Switch from Quarterly to Monthly
        console.log('[TEST] Switching back to Monthly to verify transition...');
        await page.getByTestId('edit-plan-button').click();
        await page.getByTestId('plan-freq-monthly').click();

        // Ensure it shows 30€ (monthly base)
        console.log('[TEST] Verifying monthly base remains 30€...');
        await expect(amountInput).toHaveValue('30');

        // Apply "Dès maintenant"
        await page.getByTestId('apply-mode-current').click();
        await page.getByTestId('save-plan-confirm').click();

        // 9. Verify transition (should show 30€)
        console.log('[TEST] Final verification of monthly display...');
        await expect(planDisplay).toContainText('30 €');

        // Wait for DB sync (aggregates update)
        console.log('[TEST] Waiting for DB aggregates sync...');
        await page.waitForTimeout(3000);
        await page.reload();
        await page.getByTestId('tab-payments').click({ force: true });

        // The big total balance
        const balanceDisplay = page.getByTestId('total-balance-display');
        const balanceText = await balanceDisplay.innerText();
        console.log('[TEST] Actual Balance Displayed:', balanceText);

        // The balance should be 30 now because old quarterly due was cancelled and new monthly due was created
        await expect(balanceDisplay).toContainText('30');
        console.log('[TEST] Test PASSED.');
    });
});
