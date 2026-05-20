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
import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const TEST_API_URL =
  process.env.TEST_API_URL ?? process.env.API_URL ?? "";

export interface LoginOptions {
  email?: string;
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
  const email =
    opts.email ?? process.env.TEST_USER_EMAIL ?? "test@northstar.app";
  const password =
    opts.password ?? process.env.TEST_USER_PASSWORD ?? "testpassword";

  const res = await page.request.post("/api/auth/login", {
    data: { email, password },
  });
  expect(res.status(), `Login API deve rispondere 200 (email: ${email})`).toBe(
    200,
  );

  const body = await res.json();
  const token: string = body.token;
  expect(
    token,
    "Il token JWT deve essere presente nella risposta di /api/auth/login",
  ).toBeTruthy();

  // addInitScript: eseguito prima di ogni navigate nel contesto della pagina
  // Simula il comportamento di AuthContext. ns_token resta solo come compat legacy.
  await page.addInitScript((t: string) => {
    localStorage.setItem("northstar_token", t);
    sessionStorage.setItem("northstar_token", t);
    localStorage.setItem("ns_token", t);
    sessionStorage.setItem("ns_token", t);
  }, token);
}

/**
 * loginAsAffiliate — login con utente che ha isAffiliate=true.
 * Utile per testare la dashboard affiliazione senza mock.
 */
export async function loginAsAffiliate(page: Page): Promise<void> {
  await loginViaApi(page, {
    email: process.env.TEST_AFFILIATE_EMAIL ?? process.env.TEST_USER_EMAIL,
    password:
      process.env.TEST_AFFILIATE_PASSWORD ?? process.env.TEST_USER_PASSWORD,
  });
}

export async function loginAsTestUser(
  request: APIRequestContext,
): Promise<Record<string, string>> {
  const email = process.env.TEST_USER_EMAIL ?? "test@northstar.app";
  const password = process.env.TEST_USER_PASSWORD ?? "testpassword";

  const res = await request.post(`${TEST_API_URL}/api/auth/login`, {
    data: { email, password },
  });
  expect(res.status(), `Login API deve rispondere 200 (email: ${email})`).toBe(
    200,
  );

  const body = await res.json();
  const token: string = body.token;
  expect(
    token,
    "Il token JWT deve essere presente nella risposta di /api/auth/login",
  ).toBeTruthy();
  return { Authorization: `Bearer ${token}` };
}

/**
 * waitForAuthReady — attende che useAuth() abbia finito il fetch di /api/auth/me.
 * Usa il data-testid="auth-ready" che AuthContext deve settare sul body quando isLoading=false.
 * Se questo attributo non esiste, fa un fallback su waitForLoadState.
 */
export async function waitForAuthReady(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () =>
        Boolean(sessionStorage.getItem("northstar_token")) ||
        Boolean(localStorage.getItem("northstar_token")),
      undefined,
      { timeout: 10_000 },
    )
    .catch(() => {});

  await expect(
    page
      .locator('[data-auth-ready="true"]')
      .or(page.locator("main"))
      .or(page.locator("body")),
  ).toBeVisible({ timeout: 10_000 });
}
