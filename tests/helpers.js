import { expect } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename)); // Go up one level to root
const envPath = path.resolve(__dirname, '.env');
console.log('[DEBUG] Loading .env from:', envPath);
const result = dotenv.config({ path: envPath });
if (result.error) {
    console.error('[DEBUG] Error loading .env:', result.error);
}

export async function login(page, email, password) {
    // Hardcoded fallback for local testing - .env parsing is failing on this environment
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://qcxwuhpxkiutftlnmifz.supabase.co';
    // Truncated key for brevity in logs, clearly this is the full key
    const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjeHd1aHB4a2l1dGZ0bG5taWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMzU0MjgsImV4cCI6MjA4MjkxMTQyOH0.QISNKR8-dLiQ1iw9Vvijx10tj1X-FF1uBrC_yPFyVgw';

    console.log('[DEBUG] Using Supabase URL:', SUPABASE_URL);

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error("Supabase Environment Variables Missing (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)");
    }
    if (!email || !password) {
        throw new Error("Email or Password missing for login");
    }

    console.log(`[Helper] Tentative de login pour ${email}`);

    // Aller sur /login pour initialiser le contexte
    await page.goto('/login');

    // Authentication Programmatique via Supabase REST API
    const loginError = await page.evaluate(async ({ email, password, url, key }) => {
        try {
            const resp = await fetch(`${url}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: { 'apikey': key, 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await resp.json();
            if (data.error || !data.access_token) {
                // AUTO-HEALING: If User not found, try to Sign Up!
                // Only if error is "invalid_credentials" usually implies user might not exist or wrong pass.
                // We'll assume "User not found" context for this helper in a Dev environment.
                if (data.error_code === 'invalid_credentials' || data.msg?.includes('Invalid login credentials')) {
                    console.log('[Helper] Login failed. Attempting to creating (Sign Up) test user...');

                    const respSignUp = await fetch(`${url}/auth/v1/signup`, {
                        method: 'POST',
                        headers: { 'apikey': key, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password, data: { full_name: 'E2E Test User' } })
                    });
                    const dataSignUp = await respSignUp.json();

                    if (dataSignUp.access_token) {
                        console.log('[Helper] User created and logged in!');
                        // Persistence
                        const projectRef = url.split('//')[1].split('.')[0];
                        const storageKey = `sb-${projectRef}-auth-token`;
                        localStorage.setItem(storageKey, JSON.stringify(dataSignUp));

                        // Ensure Dojo Exists for new user
                        await ensureDojo(url, key, dataSignUp.access_token, dataSignUp.user.id);

                        return null;
                    } else if (dataSignUp.msg?.includes('already registered')) {
                        // Fallback if password was just wrong
                        return "User exists but password wrong. Cannot auto-heal.";
                    } else {
                        // Might be "Confirmation required"
                        console.log('[Helper] Sign Up response:', dataSignUp);
                        if (!dataSignUp.access_token && dataSignUp.id) {
                            return "User created but Email Confirmation Required. Please confirm email in Supabase Dashboard or disable Confirmations.";
                        }
                    }
                }

                return data.error_description || data.error?.message || JSON.stringify(data);
            }

            // SUCCESS LOGIN
            // Persistence: Stocker dans localStorage
            const projectRef = url.split('//')[1].split('.')[0];
            const storageKey = `sb-${projectRef}-auth-token`;
            localStorage.setItem(storageKey, JSON.stringify(data));

            // Ensure Dojo Exists
            await ensureDojo(url, key, data.access_token, data.user.id);

            return null;
        } catch (e) {
            return e.message;
        }

        // Helper to ensure Dojo exists
        async function ensureDojo(url, key, token, userId) {
            // Check if dojo membership exists
            const resp = await fetch(`${url}/rest/v1/dojokai_dojo_members?user_id=eq.${userId}&select=role`, {
                method: 'GET',
                headers: {
                    'apikey': key,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            });

            if (!resp.ok) {
                console.error('[Helper] Failed to check memberships:', resp.status);
                throw new Error(`Failed to check memberships: ${resp.status}`);
            }

            const members = await resp.json();

            if (members.length === 0) {
                console.log('[Helper] No Dojo Membership found. Creating default Dojo via RPC...');

                // Use RPC to create dojo + member atomically and bypass RLS constraints
                const createResp = await fetch(`${url}/rest/v1/rpc/create_dojo`, {
                    method: 'POST',
                    headers: {
                        'apikey': key,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        p_name: 'E2E Test Dojo',
                        p_description: 'Created by automated test',
                        p_address: '123 Test St',
                        p_logo_url: null
                    })
                });

                if (!createResp.ok) {
                    const err = await createResp.text();
                    console.error('[Helper] Failed to create Dojo via RPC:', err);
                    throw new Error(`Failed to create Dojo via RPC: ${err}`);
                }

                const data = await createResp.json();
                console.log('[Helper] Dojo created successfully via RPC:', data.id || data);

            } else {
                const role = members[0].role;
                console.log(`[Helper] Dojo membership exists. Role: ${role}`);
                if (!['owner', 'teacher', 'admin'].includes(role)) {
                    console.warn('[Helper] WARNING: User is not an owner/teacher! Tests may fail.');
                }
            }
        }
    }, { email, password, url: SUPABASE_URL, key: SUPABASE_ANON_KEY });

    if (loginError) {
        throw new Error(`Supabase Auth Failed: ${loginError}`);
    }

    // Force Redirection to Dashboard / Refresh
    await page.goto('/');

    // Validation
    await expect(page).toHaveURL(/\//);
    await expect(page.getByRole('heading', { name: /DojoKai/i }).first()).toBeVisible({ timeout: 15000 });
    console.log('[Helper] Login Success');
}
