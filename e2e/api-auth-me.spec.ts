/**
 * E2E: API GET /api/auth/me
 *
 * Verifica che il nuovo endpoint /api/auth/me restituisca la shape
 * completa attesa da useAuth() e da WendyPage:
 *   id, name, email, isPremium, isAffiliate, sectorName, sectorId, objectives[]
 *
 * Questi test girano direttamente contro le API (nessuna navigazione UI)
 * e sono quindi molto veloci (< 2s per test in condizioni normali).
 *
 * Esecuzione:
 *   pnpm exec playwright test e2e/api-auth-me.spec.ts
 */
import { test, expect } from '@playwright/test';

// ── helpers locali ────────────────────────────────────────────────────────────

async function getAuthToken(page: import('@playwright/test').Page): Promise<string | null> {
  const email    = process.env.TEST_USER_EMAIL    ?? 'test@northstar.app';
  const password = process.env.TEST_USER_PASSWORD ?? 'testpassword';

  const res = await page.request.post('/api/auth/login', {
    data: { email, password },
  });
  if (res.status() !== 200) return null;
  const body = await res.json();
  return body.token ?? null;
}

// ── suite ────────────────────────────────────────────────────────────────

test.describe('API — GET /api/auth/me', () => {

  test('senza token → 401 Unauthorized', async ({ page }) => {
    const res = await page.request.get('/api/auth/me');
    expect(res.status()).toBe(401);
  });

  test('con Bearer token non valido → 401', async ({ page }) => {
    const res = await page.request.get('/api/auth/me', {
      headers: { Authorization: 'Bearer token.non.valido' },
    });
    expect(res.status()).toBe(401);
  });

  test('con token valido → 200 + shape completa', async ({ page }) => {
    const token = await getAuthToken(page);
    if (!token) {
      test.skip(true, 'Utente di test non disponibile — skip');
      return;
    }

    const res = await page.request.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();

    // Campi obbligatori sempre presenti
    expect(typeof body.id).toBe('number');
    expect(typeof body.name).toBe('string');
    expect(typeof body.email).toBe('string');

    // Campi critici per Wendy — aggiunti in PR #8
    expect(typeof body.isPremium).toBe('boolean');
    expect(typeof body.isAffiliate).toBe('boolean');
    expect(Array.isArray(body.objectives)).toBe(true);

    // sectorName e sectorId: null se il test RIASEC non è stato completato
    expect(
      body.sectorName === null || typeof body.sectorName === 'string',
    ).toBe(true);
    expect(
      body.sectorId === null || typeof body.sectorId === 'number',
    ).toBe(true);

    // Campi gamification
    expect(typeof body.streakDays).toBe('number');
    expect(typeof body.totalXp).toBe('number');

    // Il server non deve MAI esporre campi sensibili al client
    expect(body.passwordHash).toBeUndefined();
    expect(body.stripeCustomerId).toBeUndefined();
    expect(body.stripeSubscriptionId).toBeUndefined();
    expect(body.resetToken).toBeUndefined();
    expect(body.verificationCode).toBeUndefined();
  });

  test('GET /api/users/me → risposta identica a /api/auth/me', async ({ page }) => {
    const token = await getAuthToken(page);
    if (!token) {
      test.skip(true, 'Utente di test non disponibile — skip');
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    const [r1, r2] = await Promise.all([
      page.request.get('/api/auth/me',   { headers }),
      page.request.get('/api/users/me',  { headers }),
    ]);

    expect(r1.status()).toBe(200);
    expect(r2.status()).toBe(200);

    const b1 = await r1.json();
    const b2 = await r2.json();

    // I due endpoint devono restituire esattamente gli stessi dati
    // (stessa query, stessa logica — montati sullo stesso router)
    expect(b1).toEqual(b2);
  });

  // Objectives shape
  test('ogni objective ha id, text, category, progress', async ({ page }) => {
    const token = await getAuthToken(page);
    if (!token) {
      test.skip(true, 'Utente di test non disponibile — skip');
      return;
    }

    const res = await page.request.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { objectives } = await res.json();

    for (const obj of objectives) {
      expect(typeof obj.id).toBe('number');
      expect(typeof obj.text).toBe('string');
      expect(typeof obj.category).toBe('string');
      expect(typeof obj.progress).toBe('number');
    }
  });

});
