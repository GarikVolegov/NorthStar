/**
 * JWT middleware — verifies the Authorization: Bearer <token> header
 * and attaches the decoded payload to req.user.
 *
 * All routes mounted after  app.use('/api', jwtMiddleware)  have access
 * to (req as any).user.id (integer user ID from the token subject).
 */
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface JwtPayload {
  sub: string;   // user ID as string
  email?: string;
  iat: number;
  exp: number;
}

export function jwtMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: "JWT_SECRET not configured" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    (req as any).user = {
      id: parseInt(payload.sub, 10),
      email: payload.email,
    };
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
