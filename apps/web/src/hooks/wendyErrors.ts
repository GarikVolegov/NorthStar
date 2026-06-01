import { FATAL_ERRORS } from './wendy.config';

const AUTH_SESSION_ERROR_PATTERNS = [
  '401',
  '403',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'TOKEN',
  'SESSION_EXPIRED',
  'SESSION EXPIRED',
  'AUTH',
] as const;

export function isWendyAuthSessionError(err: Error): boolean {
  const message = err.message.toUpperCase();
  return AUTH_SESSION_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

export function isNonRetryableWendyStreamError(err: Error): boolean {
  return isWendyAuthSessionError(err) || FATAL_ERRORS.some((code) => err.message.includes(code));
}

export function friendlyWendyError(err: Error): string {
  if (err.message.includes('504') || err.message.includes('408')) {
    return 'Wendy non risponde. Controlla la connessione e riprova.';
  }
  if (err.message.includes('503')) {
    return 'Il servizio AI è momentaneamente non disponibile. Riprova tra qualche istante.';
  }
  if (isWendyAuthSessionError(err)) {
    return 'Sessione scaduta. Effettua nuovamente il login.';
  }
  return 'Wendy si è interrotta. Riprova.';
}
