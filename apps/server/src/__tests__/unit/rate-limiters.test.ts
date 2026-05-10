import { describe, it, expect } from 'vitest';

// ─── Test della logica di configurazione dei limiter ────────────────────────
// I limiter express-rate-limit sono middleware Express — testiamo le loro
// proprietà di configurazione senza avviare un server reale.

describe('Rate limiter config — valori attesi', () => {
  it('authLimiter: max 10, finestra 15min', async () => {
    const { authLimiter } = await import('../../lib/rate-limiters.js');
    // express-rate-limit espone options sull'istanza del middleware
    const opts = (authLimiter as any).options ?? (authLimiter as any)._options;
    // Compatibilità v6/v7: controlla entrambi i percorsi
    const windowMs = opts?.windowMs ?? (authLimiter as any).windowMs;
    const max = opts?.max ?? (authLimiter as any).max;
    expect(windowMs).toBe(15 * 60 * 1000);
    expect(max).toBe(10);
  });

  it('adminLimiter: max 60, finestra 1min', async () => {
    const { adminLimiter } = await import('../../lib/rate-limiters.js');
    const opts = (adminLimiter as any).options ?? (adminLimiter as any)._options;
    const windowMs = opts?.windowMs ?? (adminLimiter as any).windowMs;
    const max = opts?.max ?? (adminLimiter as any).max;
    expect(windowMs).toBe(60 * 1000);
    expect(max).toBe(60);
  });

  it('aiLimiter: max 20, finestra 1min', async () => {
    const { aiLimiter } = await import('../../lib/rate-limiters.js');
    const opts = (aiLimiter as any).options ?? (aiLimiter as any)._options;
    const windowMs = opts?.windowMs ?? (aiLimiter as any).windowMs;
    const max = opts?.max ?? (aiLimiter as any).max;
    expect(windowMs).toBe(60 * 1000);
    expect(max).toBe(20);
  });

  it('uploadLimiter: max 5, finestra 10min', async () => {
    const { uploadLimiter } = await import('../../lib/rate-limiters.js');
    const opts = (uploadLimiter as any).options ?? (uploadLimiter as any)._options;
    const windowMs = opts?.windowMs ?? (uploadLimiter as any).windowMs;
    const max = opts?.max ?? (uploadLimiter as any).max;
    expect(windowMs).toBe(10 * 60 * 1000);
    expect(max).toBe(5);
  });

  it('passwordResetLimiter: max 3, finestra 30min', async () => {
    const { passwordResetLimiter } = await import('../../lib/rate-limiters.js');
    const opts = (passwordResetLimiter as any).options ?? (passwordResetLimiter as any)._options;
    const windowMs = opts?.windowMs ?? (passwordResetLimiter as any).windowMs;
    const max = opts?.max ?? (passwordResetLimiter as any).max;
    expect(windowMs).toBe(30 * 60 * 1000);
    expect(max).toBe(3);
  });
});
