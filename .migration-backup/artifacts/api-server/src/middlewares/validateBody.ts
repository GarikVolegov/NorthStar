/**
 * validateBody — Zod body validation middleware
 *
 * Valida req.body contro uno schema Zod e chiama next(error) se non valido.
 * Compatibile con l'error handler centralizzato (error-handler.ts).
 *
 * Uso:
 *   import { validateBody } from '../middlewares/validateBody';
 *   router.post('/route', validateBody(MySchema), handler);
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Dati non validi',
        details: result.error.flatten(),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
