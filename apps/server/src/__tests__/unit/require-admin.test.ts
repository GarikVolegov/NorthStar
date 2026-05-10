import { describe, it, expect, vi, beforeEach } from 'vitest';
import { timingSafeEqual } from 'crypto';

// ─── requireAdmin inline (stessa logica di middlewares/requireAdmin.ts) ──────
const ADMIN_KEY = 'test-admin-key';

function isValidAdminKey(provided: string): boolean {
  if (!ADMIN_KEY || !provided) return false;
  try {
    const a = Buffer.from(provided.padEnd(ADMIN_KEY.length, '\0'));
    const b = Buffer.from(ADMIN_KEY.padEnd(provided.length, '\0'));
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b) && provided.length === ADMIN_KEY.length;
  } catch {
    return false;
  }
}

function requireAdmin(req: any, res: any, next: any): void {
  const provided = req.headers?.['x-admin-key'];
  if (!provided || typeof provided !== 'string') {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }
  if (!isValidAdminKey(provided)) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }
  next();
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('requireAdmin middleware', () => {
  it('chiave assente → 401 UNAUTHORIZED', () => {
    const res = mockRes();
    requireAdmin({ headers: {} }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].error).toBe('UNAUTHORIZED');
  });

  it('chiave errata → 403 FORBIDDEN', () => {
    const res = mockRes();
    requireAdmin({ headers: { 'x-admin-key': 'wrong-key' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].error).toBe('FORBIDDEN');
  });

  it('chiave corretta → chiama next()', () => {
    const next = vi.fn();
    const res = mockRes();
    requireAdmin({ headers: { 'x-admin-key': ADMIN_KEY } }, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('timing-safe: chiave con prefisso corretto ma più corta → 403', () => {
    const res = mockRes();
    requireAdmin({ headers: { 'x-admin-key': ADMIN_KEY.slice(0, -1) } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('timing-safe: chiave con prefisso corretto ma più lunga → 403', () => {
    const res = mockRes();
    requireAdmin({ headers: { 'x-admin-key': ADMIN_KEY + 'x' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('header array (HTTP/2 multi-value) → 401', () => {
    const res = mockRes();
    requireAdmin({ headers: { 'x-admin-key': [ADMIN_KEY, ADMIN_KEY] } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('isValidAdminKey — timing safety', () => {
  it('chiave vuota → false', () => {
    expect(isValidAdminKey('')).toBe(false);
  });

  it('chiave corretta → true', () => {
    expect(isValidAdminKey(ADMIN_KEY)).toBe(true);
  });

  it('chiave di lunghezza diversa → false (anche con stesso prefisso)', () => {
    expect(isValidAdminKey(ADMIN_KEY + 'extra')).toBe(false);
  });
});
