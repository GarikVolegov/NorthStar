/**
 * requireAuth middleware
 *
 * Verifica il JWT Bearer token in Authorization header.
 * Popola req.user con { id, email, role, isPremium } dopo verifica.
 *
 * Uso:
 *   import { requireAuth } from '../middlewares/requireAuth';
 *   router.get('/profile', requireAuth, handler);
 *
 * Estende Express.Request via module augmentation (vedi types/express.d.ts).
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../lib/logger.js';

const JWT_SECRET = process.env.JWT_SECRET ?? '';

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET env var è obbligatoria in produzione.');
}

export interface JwtPayload {
  sub: number;       // user ID
  email: string;
  role: 'user' | 'admin';
  isPremium: boolean;
  iat: number;
  exp: number;
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token JWT richiesto.' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as any).user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role ?? 'user',
      isPremium: payload.isPremium ?? false,
    };
    next();
  } catch (err) {
    const isExpired = err instanceof jwt.TokenExpiredError;
    logger.warn(
      { ip: req.ip, url: req.url, expired: isExpired },
      'JWT non valido o scaduto',
    );
    res.status(401).json({
      error: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      message: isExpired ? 'Sessione scaduta. Effettua nuovamente il login.' : 'Token non valido.',
    });
  }
}

/**
 * requirePremium — verifica che l'utente abbia un account premium
 * Deve essere usato dopo requireAuth (dipende da req.user)
 */
export function requirePremium(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = (req as any).user;
  if (!user?.isPremium) {
    res.status(403).json({
      error: 'PREMIUM_REQUIRED',
      message: 'Questa funzionalità richiede un piano premium.',
    });
    return;
  }
  next();
}
