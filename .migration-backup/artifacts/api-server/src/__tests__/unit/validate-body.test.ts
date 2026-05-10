import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

// ─── validateBody inline ─────────────────────────────────────────────────────
function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
}

describe('validateBody middleware', () => {
  const TailorSchema = z.object({
    jobTitle: z.string().min(1).max(200),
    jobDescription: z.string().min(10).max(5000),
    targetCompany: z.string().max(200).optional(),
  });

  it('chiama next() senza errore se il body è valido', () => {
    const middleware = validateBody(TailorSchema);
    const req = { body: { jobTitle: 'Software Engineer', jobDescription: 'Build cool things at a tech company', targetCompany: 'Acme' } };
    const next = vi.fn();
    middleware(req, {}, next);
    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('chiama next(ZodError) se il body non è valido', () => {
    const middleware = validateBody(TailorSchema);
    const req = { body: { jobTitle: '', jobDescription: 'corto' } };
    const next = vi.fn();
    middleware(req, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
    const arg = next.mock.calls[0][0];
    expect(arg).toBeInstanceOf(z.ZodError);
  });

  it('sostituisce req.body con i dati parsed e sanitizzati', () => {
    const middleware = validateBody(TailorSchema);
    const req = { body: { jobTitle: 'Dev', jobDescription: 'A valid job description here', extraField: 'ignored' } };
    const next = vi.fn();
    middleware(req, {}, next);
    expect(req.body).not.toHaveProperty('extraField');  // strip fields not in schema
    expect(req.body.jobTitle).toBe('Dev');
  });

  it('campo opzionale assente → next() senza errore', () => {
    const middleware = validateBody(TailorSchema);
    const req = { body: { jobTitle: 'PM', jobDescription: 'Define product roadmap and strategy' } };
    const next = vi.fn();
    middleware(req, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('body null o undefined → next(ZodError)', () => {
    const middleware = validateBody(TailorSchema);
    const req = { body: null };
    const next = vi.fn();
    middleware(req, {}, next);
    const arg = next.mock.calls[0][0];
    expect(arg).toBeInstanceOf(z.ZodError);
  });
});
