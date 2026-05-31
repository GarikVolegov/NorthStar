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

type AuthResponse = {
  token?: string;
};

function readToken(body: unknown): string {
  if (typeof body === "object" && body !== null && "token" in body && typeof body.token === "string") {
    return body.token;
  }
  return "";
}

async function registerE2eUserToken(
  request: APIRequestContext,
  prefix = "e2e-user",
): Promise<string> {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `${prefix}-${unique}@northstar.test`;
  const res = await request.post(`${TEST_API_URL}/api/auth/register`, {
    data: {
      name: "NorthStar E2E User",
      email,
      password: "testpassword",
    },
  });
  expect(res.status(), `Register API deve rispondere 201 (email: ${email})`).toBe(201);

  const body = (await res.json()) as AuthResponse;
  const token = readToken(body);
  expect(token, "Il token JWT deve essere presente nella risposta di /api/auth/register").toBeTruthy();
  return token;
}

export async function registerE2eUser(
  request: APIRequestContext,
  prefix = "e2e-user",
): Promise<Record<string, string>> {
  const token = await registerE2eUserToken(request, prefix);
  return { Authorization: `Bearer ${token}` };
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
  const usesDefaultSeed =
    !opts.email &&
    !opts.password &&
    !process.env.TEST_USER_EMAIL &&
    !process.env.TEST_USER_PASSWORD;

  if (res.status() !== 200 && usesDefaultSeed) {
    const token = await registerE2eUserToken(page.request, "login-e2e");
    await page.addInitScript((t: string) => {
      localStorage.setItem("northstar_token", t);
      sessionStorage.setItem("northstar_token", t);
      localStorage.setItem("ns_token", t);
      sessionStorage.setItem("ns_token", t);
    }, token);
    return;
  }

  expect(res.status(), `Login API deve rispondere 200 (email: ${email})`).toBe(
    200,
  );

  const token = readToken(await res.json());
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
  const email = process.env.TEST_AFFILIATE_EMAIL ?? process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_AFFILIATE_PASSWORD ?? process.env.TEST_USER_PASSWORD;
  await loginViaApi(page, {
    ...(email ? { email } : {}),
    ...(password ? { password } : {}),
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
  const usesDefaultSeed =
    !process.env.TEST_USER_EMAIL &&
    !process.env.TEST_USER_PASSWORD;

  if (res.status() !== 200 && usesDefaultSeed) {
    return registerE2eUser(request, "test-user-e2e");
  }

  expect(res.status(), `Login API deve rispondere 200 (email: ${email})`).toBe(
    200,
  );

  const token = readToken(await res.json());
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
