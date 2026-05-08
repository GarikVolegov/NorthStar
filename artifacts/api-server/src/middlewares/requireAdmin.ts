/**
 * requireAdmin middleware
 *
 * Protegge le route /api/admin/* verificando due condizioni:
 *   1. Header x-admin-key corrisponde a ADMIN_KEY env var
 *   2. (opzionale) Se JWT auth presente, verifica che il ruolo sia 'admin'
 *
 * Uso:
 *   import { requireAdmin } from '../middlewares/requireAdmin';
 *   router.get('/admin/metrics', requireAdmin, handler);
 *
 * Risposta su fallimento: 401 UNAUTHORIZED o 403 FORBIDDEN
 * — MAI rivelare se la chiave esiste o meno (timing-safe comparison)
 */
import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { logger } from '../lib/logger.js';

const ADMIN_KEY = process.env.ADMIN_KEY ?? '';

if (!ADMIN_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('ADMIN_KEY env var è obbligatoria in produzione.');
}

/**
 * Confronto timing-safe per evitare timing attacks sulla chiave admin.
 * Un confronto naïve (===) può essere vulnerabile a attacchi side-channel
 * che misurano la differenza di tempo tra prefissi corretti e scorretti.
 */
function isValidAdminKey(provided: string): boolean {
  if (!ADMIN_KEY || !provided) return false;
  try {
    // Buffer di lunghezza uguale obbligatorio per timingSafeEqual
    const a = Buffer.from(provided.padEnd(ADMIN_KEY.length, '\0'));
    const b = Buffer.from(ADMIN_KEY.padEnd(provided.length, '\0'));
    // Lunghezze devono essere uguali — se non lo sono, la chiave è sbagliata
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b) && provided.length === ADMIN_KEY.length;
  } catch {
    return false;
  }
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const provided = req.headers['x-admin-key'];

  // Nessun header presente
  if (!provided || typeof provided !== 'string') {
    logger.warn(
      { ip: req.ip, url: req.url, method: req.method },
      'Admin route: header x-admin-key mancante',
    );
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Autenticazione richiesta.',
    });
    return;
  }

  // Chiave presente ma errata
  if (!isValidAdminKey(provided)) {
    logger.warn(
      { ip: req.ip, url: req.url, method: req.method },
      'Admin route: x-admin-key non valida — possibile attacco brute force',
    );
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Accesso negato.',
    });
    return;
  }

  next();
}

/**
 * requireAdminRole — verifica che il JWT decodificato contenga role === 'admin'
 *
 * Usare in aggiunta a requireAdmin per route extra-sensibili
 * che richiedono sia la chiave API sia un account admin registrato.
 *
 * Prerequisito: authMiddleware deve aver già popolato req.user
 */
export function requireAdminRole(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = (req as any).user;

  if (!user) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token JWT richiesto.' });
    return;
  }

  if (user.role !== 'admin') {
    logger.warn(
      { userId: user.id, url: req.url },
      'Accesso admin negato: ruolo insufficiente',
    );
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Ruolo admin richiesto per questa operazione.',
    });
    return;
  }

  next();
}
