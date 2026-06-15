import type { Request, Response, NextFunction } from "express";

/**
 * requireOwnership — garantisce che l'utente autenticato sia il proprietario
 * della risorsa identificata da un route param (default `:userId`).
 * Gli admin bypassano il controllo.
 *
 * SICUREZZA: l'identità del chiamante viene SEMPRE presa da `req.user.id`
 * (dal JWT verificato), mai da query/body/param forniti dal client. Va montato
 * DOPO `requireAuth`. Centralizza il pattern copia-incollato in più route ed
 * evita IDOR da omissione del controllo (vedi SECURITY_RULES.md §Database).
 */
export function requireOwnership(param = "userId") {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const target = Number.parseInt(req.params[param] ?? "", 10);
    if (Number.isNaN(target)) {
      res.status(400).json({ error: "ID utente non valido" });
      return;
    }
    if (target !== req.user.id && req.user.role !== "admin") {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }
    next();
  };
}
