import { describe, it, expect, vi } from 'vitest';
import { ZodError, z } from 'zod';

// ─── AppError + errorHandler inline ─────────────────────────────────────────
class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

function errorHandler(err: unknown, req: any, res: any, _next: any): void {
  const requestId = req.id ?? 'test-req-id';

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      requestId,
      issues: err.issues.map((i: any) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code ?? 'APP_ERROR',
      message: err.message,
      requestId,
    });
    return;
  }
  res.status(500).json({ error: 'INTERNAL_ERROR', requestId });
}

// ─── Mock di req/res ─────────────────────────────────────────────────────────
function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const mockReq = { id: 'req-123', url: '/test', method: 'GET' };

describe('errorHandler', () => {
  it('ZodError → 400 con lista issues strutturata', () => {
    const schema = z.object({ email: z.string().email(), age: z.number().min(18) });
    const result = schema.safeParse({ email: 'not-an-email', age: 10 });
    const res = mockRes();
    errorHandler(result.error!, mockReq, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.requestId).toBe('req-123');
    expect(body.issues).toHaveLength(2);
    expect(body.issues[0]).toHaveProperty('path');
    expect(body.issues[0]).toHaveProperty('message');
  });

  it('AppError → statusCode corretto + code nel body', () => {
    const err = new AppError(404, 'Utente non trovato', 'USER_NOT_FOUND');
    const res = mockRes();
    errorHandler(err, mockReq, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe('USER_NOT_FOUND');
    expect(body.message).toBe('Utente non trovato');
    expect(body.requestId).toBe('req-123');
  });

  it('AppError senza code → fallback APP_ERROR', () => {
    const err = new AppError(403, 'Accesso negato');
    const res = mockRes();
    errorHandler(err, mockReq, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].error).toBe('APP_ERROR');
  });

  it('Errore generico → 500 INTERNAL_ERROR', () => {
    const res = mockRes();
    errorHandler(new Error('crash inaspettato'), mockReq, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error).toBe('INTERNAL_ERROR');
  });

  it('requestId incluso in tutte le risposte di errore', () => {
    const errs = [
      new AppError(400, 'bad'),
      new Error('generic'),
    ];
    for (const err of errs) {
      const res = mockRes();
      errorHandler(err, mockReq, res, vi.fn());
      expect(res.json.mock.calls[0][0].requestId).toBe('req-123');
    }
  });
});
