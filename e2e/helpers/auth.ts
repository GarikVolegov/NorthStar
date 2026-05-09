/**
 * e2e/helpers/auth.ts — Helper condiviso per autenticazione nei test Playwright
 *
 * Uso:
 *   import { loginViaApi } from './helpers/auth';
 *   test.beforeEach(async ({ page }) => { await loginViaApi(page); });
 *
 * Strategia:
 *   POST /api/auth/login con credenziali da env  → ottiene JWT
 *   Inietta il token in localStorage via addInitScript
 *   così ogni navigate successivo parte già autenticato.
 *
 * Variabili env richieste (.env.test o CI secrets):
 *   TEST_USER_EMAIL    (default: test@northstar.app)
 *   TEST_USER_PASSWORD (default: testpassword)
 *   TEST_AFFILIATE_EMAIL    (opzionale: utente con isAffiliate=true)
 *   TEST_AFFILIATE_PASSWORD (opzionale)
 */
import { expect, type Page } from '@playwright/test';

export interface LoginOptions {
  email?:    string;
  password?: string;
}

/**
 * loginViaApi — esegue login via API e inietta il token JWT in localStorage.
 * Più veloce e stabile del login via form UI.
 */
export async function loginViaApi(
  page: Page,
  opts: LoginOptions = {},
): Promise<void> {
  const email    = opts.email    ?? process.env.TEST_USER_EMAIL    ?? 'test@northstar.app';
  const password = opts.password ?? process.env.TEST_USER_PASSWORD ?? 'testpassword';

  const res = await page.request.post('/api/auth/login', {
    data: { email, password },
  });
  expect(res.status(), `Login API deve rispondere 200 (email: ${email})`).toBe(200);

  const body = await res.json();
  const token: string = body.token;
  expect(token, 'Il token JWT deve essere presente nella risposta di /api/auth/login').toBeTruthy();

  // addInitScript: eseguito prima di ogni navigate nel contesto della pagina
  // Simula esattamente il comportamento di AuthContext che legge ns_token da localStorage
  await page.addInitScript((t: string) => {
    localStorage.setItem('ns_token', t);
  }, token);
}

/**
 * loginAsAffiliate — login con utente che ha isAffiliate=true.
 * Utile per testare la dashboard affiliazione senza mock.
 */
export async function loginAsAffiliate(page: Page): Promise<void> {
  await loginViaApi(page, {
    email:    process.env.TEST_AFFILIATE_EMAIL    ?? process.env.TEST_USER_EMAIL,
    password: process.env.TEST_AFFILIATE_PASSWORD ?? process.env.TEST_USER_PASSWORD,
  });
}

/**
 * waitForAuthReady — attende che useAuth() abbia finito il fetch di /api/auth/me.
 * Usa il data-testid="auth-ready" che AuthContext deve settare sul body quando isLoading=false.
 * Se questo attributo non esiste, fa un fallback su waitForLoadState.
 */
export async function waitForAuthReady(page: Page): Promise<void> {
  await Promise.race([
    page.waitForSelector('[data-auth-ready="true"]', { timeout: 10_000 })
      .catch(() => { /* attributo non presente — usa fallback */ }),
    page.waitForLoadState('networkidle', { timeout: 10_000 })
      .catch(() => { /* timeout — continua */ }),
  ]);
}
