/**
 * E2E: Percorso Critico — Referral Flow (integrazione end-to-end)
 *
 * Simula il comportamento completo di un utente lungo i tre passi critici:
 *   1. Creazione account (registrazione via API)
 *   2. Generazione e validazione del link di affiliazione
 *   3. Registrazione tramite referral (un nuovo utente si iscrive con ?ref=CODE)
 *
 * Prerequisiti ENV:
 *   TEST_USER_EMAIL / TEST_USER_PASSWORD   → utente esistente
 *   TEST_AFFILIATE_EMAIL / TEST_AFFILIATE_PASSWORD → opzionale
 *
 * I test che creano utenti usa email univoche (timestamp) così possono
 * girare più volte in parallelo senza collisioni.
 *
 * Esecuzione:
 *   pnpm exec playwright test e2e/referral-flow.spec.ts
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { loginAsAffiliate, waitForAuthReady } from './helpers/auth';
import { responseJson } from './helpers/json';

type RegisterResponse = {
  id?: number | string;
  token?: string;
  userId?: number | string;
  email?: string;
  user?: { id?: number | string; email?: string };
  devCode?: string;
  needsVerification?: boolean;
  needs2fa?: boolean;
};

type LoginResponse = {
  token?: string;
  email?: string;
  devCode?: string;
  needsVerification?: boolean;
  needs2fa?: boolean;
};

type AffiliateDashboard = {
  referralCode?: string;
  code?: string;
  referralLink?: string;
  link?: string;
  totalReferrals?: number;
  referralsCount?: number;
};

function readReferralCount(body: AffiliateDashboard): number {
  return body.totalReferrals ?? body.referralsCount ?? 0;
}

function readUserId(body: RegisterResponse): number | string | undefined {
  return body.userId ?? body.user?.id ?? body.id;
}

async function completeAuthChallenge(
  request: APIRequestContext,
  response: LoginResponse,
  fallbackEmail: string,
): Promise<LoginResponse> {
  if (response.token || !response.devCode) return response;

  const email = response.email ?? fallbackEmail;
  const endpoint = response.needs2fa ? "/api/auth/verify-2fa" : "/api/auth/verify-email";
  const verifyRes = await request.post(endpoint, {
    data: { email, code: response.devCode },
  });
  expect(verifyRes.status(), `${endpoint} deve rispondere 200`).toBe(200);
  return responseJson<LoginResponse>(verifyRes);
}

type ReferralOwnerSource = 'configured-affiliate' | 'configured-user' | 'registered-e2e';

type ReferralOwner =
  | { token: string; source: ReferralOwnerSource }
  | { skipReason: string };

// ── Utility ─────────────────────────────────────────────────────────────────

/** Genera credenziali univoche per ogni esecuzione del test. */
function uniqueUser(prefix = 'e2e') {
  const ts = Date.now();
  return {
    email:    `${prefix}+${ts}@northstar-test.app`,
    password: `TestPass${ts}!`,
    name:     `E2E User ${ts}`,
  };
}

/**
 * Registra un nuovo utente via API e restituisce il token JWT.
 * Assume che esista una route POST /api/auth/register.
 */
async function registerUser(
  request: APIRequestContext,
  user: { email: string; password: string; name: string },
  referralCode?: string,
): Promise<{ token: string; userId: number | string }> {
  const payload: Record<string, string> = {
    email:    user.email,
    password: user.password,
    name:     user.name,
  };
  if (referralCode) payload.referralCode = referralCode;

  const res = await request.post('/api/auth/register', { data: payload });
  expect(
    res.status(),
    `Registrazione fallita per ${user.email} — risposta: ${res.status()}`,
  ).toBe(201);

  const body = await responseJson<RegisterResponse>(res);
  expect(body.token,  'Token JWT assente nella risposta di /api/auth/register').toBeTruthy();
  expect(readUserId(body), 'userId assente nella risposta').toBeTruthy();

  return { token: body.token ?? "", userId: readUserId(body) ?? "" };
}

async function tryLogin(
  request: APIRequestContext,
  email: string | undefined,
  password: string | undefined,
  source: ReferralOwnerSource,
): Promise<ReferralOwner | null> {
  if (!email || !password) return null;

  const loginRes = await request.post('/api/auth/login', {
    data: { email, password },
  });
  if (loginRes.status() !== 200) return null;

  const { token } = await responseJson<LoginResponse>(loginRes);
  if (!token) {
    return { skipReason: `Account ${source} disponibile ma token assente da /api/auth/login` };
  }
  return { token, source };
}

async function createReferralOwner(request: APIRequestContext): Promise<ReferralOwner> {
  const configuredAffiliate = await tryLogin(
    request,
    process.env.TEST_AFFILIATE_EMAIL,
    process.env.TEST_AFFILIATE_PASSWORD,
    'configured-affiliate',
  );
  if (configuredAffiliate) return configuredAffiliate;

  const configuredUser = await tryLogin(
    request,
    process.env.TEST_USER_EMAIL,
    process.env.TEST_USER_PASSWORD,
    'configured-user',
  );
  if (configuredUser) return configuredUser;

  const owner = uniqueUser('ref-owner');
  const registerRes = await request.post('/api/auth/register', {
    data: { email: owner.email, password: owner.password, name: owner.name },
  });
  if (registerRes.status() !== 201) {
    return {
      skipReason:
        `Nessun account seed disponibile e registrazione E2E non riuscita ` +
        `(POST /api/auth/register -> ${registerRes.status()})`,
    };
  }

  const body = await responseJson<RegisterResponse>(registerRes);
  if (!body.token) {
    return { skipReason: 'Registrazione E2E riuscita ma token assente nella risposta' };
  }
  return { token: body.token, source: 'registered-e2e' };
}

async function getReferralOwnerOrSkip(request: APIRequestContext): Promise<{ token: string; source: ReferralOwnerSource }> {
  const owner = await createReferralOwner(request);
  if ('skipReason' in owner) {
    test.skip(true, owner.skipReason);
    return { token: '', source: 'registered-e2e' };
  }

  test.info().annotations.push({
    type: 'referral-owner',
    description: owner.source,
  });
  return owner;
}

/**
 * Ottiene il dashboard affiliazione (codice referral) per l'utente
 * identificato dal token JWT fornito.
 */
async function getAffiliateDashboard(
  request: APIRequestContext,
  token: string,
): Promise<{ referralCode: string; referralLink: string }> {
  const res = await request.get('/api/affiliate/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status(), 'GET /api/affiliate/dashboard deve rispondere 200').toBe(200);

  const body = await responseJson<AffiliateDashboard>(res);
  expect(body.referralCode ?? body.code, 'Codice referral assente').toBeTruthy();

  const code = body.referralCode ?? body.code ?? "";
  const link = body.referralLink ?? body.link ?? `${process.env.BASE_URL ?? 'http://localhost:5173'}?ref=${code}`;
  return { referralCode: code, referralLink: link };
}

// ── Suite principale ─────────────────────────────────────────────────────────

test.describe('Percorso Critico — Referral Flow', () => {

  // ── Step 1: Creazione Account ──────────────────────────────────────────────

  test.describe('Step 1 · Creazione Account', () => {

    test('POST /api/auth/register crea un account e restituisce JWT', async ({ request }) => {
      const user = uniqueUser('reg');
      const res  = await request.post('/api/auth/register', {
        data: { email: user.email, password: user.password, name: user.name },
      });
      expect(res.status()).toBe(201);

      const body = await responseJson<RegisterResponse>(res);
      expect(body.token).toBeTruthy();
      expect(readUserId(body)).toBeTruthy();
    });

    test('POST /api/auth/register con email già esistente → 409', async ({ request }) => {
      const user = uniqueUser('dup');
      // Prima registrazione — deve riuscire
      await request.post('/api/auth/register', {
        data: { email: user.email, password: user.password, name: user.name },
      });
      // Seconda registrazione con la stessa email — deve fallire
      const res = await request.post('/api/auth/register', {
        data: { email: user.email, password: user.password, name: user.name },
      });
      expect(res.status()).toBe(409);
    });

    test('POST /api/auth/register con password troppo corta → 422', async ({ request }) => {
      const user = uniqueUser('short');
      const res  = await request.post('/api/auth/register', {
        data: { email: user.email, password: '123', name: user.name },
      });
      expect([400, 422]).toContain(res.status());
    });

    test('login immediato dopo registrazione funziona', async ({ request }) => {
      const user = uniqueUser('login');
      const registerRes = await request.post('/api/auth/register', {
        data: { email: user.email, password: user.password, name: user.name },
      });
      const registered = await responseJson<RegisterResponse>(registerRes);

      const loginRes = await request.post('/api/auth/login', {
        data: { email: user.email, password: user.password },
      });
      expect(loginRes.status()).toBe(200);
      const body = await completeAuthChallenge(
        request,
        await responseJson<LoginResponse>(loginRes),
        registered.email ?? user.email,
      );
      expect(body.token ?? registered.token).toBeTruthy();
    });

  });

  // ── Step 2: Generazione Link di Affiliazione ───────────────────────────────

  test.describe('Step 2 · Generazione Link Affiliazione', () => {

    test('utente affiliato riceve referralCode e referralLink validi', async ({ request }) => {
      const { token } = await getReferralOwnerOrSkip(request);
      const { referralCode, referralLink } = await getAffiliateDashboard(request, token);
      expect(referralCode).toMatch(/^[a-zA-Z0-9_-]{4,}$/);
      expect(referralLink).toMatch(/^https?:\/\/.+/);
    });

    test('GET /api/affiliate/dashboard senza token → 401', async ({ request }) => {
      const res = await request.get('/api/affiliate/dashboard');
      expect(res.status()).toBe(401);
    });

    test('utente normale → GET /api/affiliate/dashboard restituisce 200 e genera referral', async ({ request }) => {
      const user = uniqueUser('nonaff');
      const { token } = await registerUser(request, user);

      const res = await request.get('/api/affiliate/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);
      const body = await responseJson<AffiliateDashboard>(res);
      expect(body.referralCode ?? body.code).toBeTruthy();
      expect(body.referralLink ?? body.link).toMatch(/\/sign-up\?ref=/);
    });

    test('UI: input readonly mostra link che inizia con http', async ({ page }) => {
      await loginAsAffiliate(page);
      await page.goto('/affiliate');
      await waitForAuthReady(page);

      const input = page.locator('input[readonly]').first();
      await expect(input).toBeVisible({ timeout: 20_000 });

      const value = await input.inputValue();
      expect(value).toMatch(/^https?:\/\//);
      expect(value.length).toBeGreaterThan(10);
    });

  });

  // ── Step 3: Registrazione tramite Referral ─────────────────────────────────

  test.describe('Step 3 · Registrazione tramite Referral', () => {

    test('nuovo utente che si registra con referralCode valido riceve 201', async ({ request }) => {
      // 1) Ottieni il codice referral da un account configurato o creato via API.
      const { token } = await getReferralOwnerOrSkip(request);
      const { referralCode } = await getAffiliateDashboard(request, token);

      // 2) Registra nuovo utente con il codice referral
      const newUser = uniqueUser('referred');
      const res = await request.post('/api/auth/register', {
        data: {
          email:        newUser.email,
          password:     newUser.password,
          name:         newUser.name,
          referralCode,
        },
      });
      expect(res.status()).toBe(201);
      const body = await responseJson<RegisterResponse>(res);
      expect(body.token).toBeTruthy();
    });

    test('registrazione con referralCode inesistente → 400 o 404', async ({ request }) => {
      const newUser = uniqueUser('badref');
      const res = await request.post('/api/auth/register', {
        data: {
          email:        newUser.email,
          password:     newUser.password,
          name:         newUser.name,
          referralCode: 'CODICE_INESISTENTE_XYZ999',
        },
      });
      expect([400, 404, 422]).toContain(res.status());
    });

    test('il referral viene tracciato: il contatore referrals dell\'affiliato aumenta', async ({ request }) => {
      const { token: affiliateToken } = await getReferralOwnerOrSkip(request);
      expect(affiliateToken).toBeTruthy();

      // Snapshot prima
      const beforeRes = await request.get('/api/affiliate/dashboard', {
        headers: { Authorization: `Bearer ${affiliateToken}` },
      });
      const before = await responseJson<AffiliateDashboard>(beforeRes);
      const countBefore = readReferralCount(before);

      // Registra nuovo utente con referral
      const { referralCode } = await getAffiliateDashboard(request, affiliateToken ?? "");
      const newUser = uniqueUser('tracked');
      await registerUser(request, newUser, referralCode);

      // Snapshot dopo (piccolo ritardo per propagazione asincrona)
      await new Promise(r => setTimeout(r, 800));
      const afterRes = await request.get('/api/affiliate/dashboard', {
        headers: { Authorization: `Bearer ${affiliateToken}` },
      });
      const after = await responseJson<AffiliateDashboard>(afterRes);
      const countAfter = readReferralCount(after);

      expect(countAfter).toBeGreaterThanOrEqual(countBefore + 1);
    });

  });

  // ── Step 4: Flusso Integrato End-to-End ───────────────────────────────────

  test.describe('Step 4 · Flusso Integrato (Registrazione → Link → Referral)', () => {

    /**
     * Test principale: simula il percorso completo di un utente in un singolo flusso.
     * Non usa mock — chiama le API reali in sequenza.
     *
     * Flusso:
     *   A) Utente A si registra
     *   B) Utente A diventa affiliato (se il sistema lo consente automaticamente
     *      o si usa un utente affiliato esistente come proxy)
     *   C) Utente A genera il link di affiliazione
     *   D) Utente B si registra tramite il link di A
     *   E) Si verifica che il referral sia stato registrato correttamente
     */
    test('flusso completo: registrazione → link affiliazione → registrazione referral', async ({ request }) => {
      // A) Usa un account configurato se disponibile, altrimenti crea un owner E2E unico.
      const { token: affiliateToken } = await getReferralOwnerOrSkip(request);
      expect(affiliateToken).toBeTruthy();

      // B) Recupera codice referral dell'affiliato
      const { referralCode, referralLink } = await getAffiliateDashboard(request, affiliateToken);
      expect(referralCode).toBeTruthy();
      expect(referralLink).toMatch(/^https?:\/\//);

      // C) Snapshot contatore referral prima
      const dashBeforeRes = await request.get('/api/affiliate/dashboard', {
        headers: { Authorization: `Bearer ${affiliateToken}` },
      });
      const dashBefore = await responseJson<AffiliateDashboard>(dashBeforeRes);
      const refCountBefore = readReferralCount(dashBefore);

      // D) Nuovo utente si registra tramite il codice referral
      const referred = uniqueUser('e2e-flow');
      const { token: referredToken } = await registerUser(request, referred, referralCode);
      expect(referredToken).toBeTruthy();

      // E) Verifica che il nuovo utente sia autenticato correttamente
      const meRes = await request.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${referredToken}` },
      });
      expect(meRes.status()).toBe(200);
      const me = await responseJson<RegisterResponse>(meRes);
      expect(me.email ?? me.user?.email).toBe(referred.email);

      // F) Verifica che il contatore referral sia aumentato
      await new Promise(r => setTimeout(r, 800));
      const dashAfterRes = await request.get('/api/affiliate/dashboard', {
        headers: { Authorization: `Bearer ${affiliateToken}` },
      });
      const dashAfter = await responseJson<AffiliateDashboard>(dashAfterRes);
      const refCountAfter = readReferralCount(dashAfter);

      expect(refCountAfter).toBeGreaterThanOrEqual(refCountBefore + 1);
    });

    test('UI: apertura URL con ?ref=CODE conserva il referral senza account seed', async ({ page }) => {
      const referralCode = `E2E_REF_${Date.now()}`;

      // Naviga alla pagina di registrazione con il codice referral nel querystring.
      await page.goto(`/sign-up?ref=${referralCode}`);
      await expect(page.locator('body')).toBeVisible({ timeout: 10_000 });

      // Verifica che il codice sia memorizzato prima del completamento Clerk.
      const stored = await page.evaluate(
        (code) =>
          localStorage.getItem('referralCode') === code ||
          sessionStorage.getItem('referralCode') === code,
        referralCode,
      );
      if (!stored) {
        await page.waitForFunction(
          (code) =>
            localStorage.getItem('referralCode') === code ||
            sessionStorage.getItem('referralCode') === code,
          referralCode,
          { timeout: 5_000 },
        ).catch(() => undefined);
      }

      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));
      const critical = errors.filter(e => !e.includes('Warning:') && !e.includes('[Fast Refresh]'));
      expect(critical).toHaveLength(0);
      const storedAfterWait = await page.evaluate(
        (code) =>
          localStorage.getItem('referralCode') === code ||
          sessionStorage.getItem('referralCode') === code,
        referralCode,
      );
      expect(storedAfterWait).toBeTruthy();
    });

  });

});
