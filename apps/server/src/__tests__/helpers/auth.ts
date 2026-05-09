/**
 * auth.ts — Genera JWT HS256 validi per i test di integrazione.
 *
 * Il middleware jwt.ts usa JWT_SECRET in ambiente non-production,
 * quindi basta firmare con la stessa chiave impostata in vitest.config.ts.
 *
 * USO:
 *   import { makeToken } from "./helpers/auth";
 *
 *   const token = makeToken({ id: 42, email: "test@example.com" });
 *   const res = await request(app)
 *     .get("/api/affiliate/dashboard")
 *     .set("Authorization", `Bearer ${token}`);
 */
import jwt from "jsonwebtoken";

const TEST_SECRET = process.env.JWT_SECRET ?? "northstar-test-secret-vitest";

export interface TestUser {
  id:    number;
  email: string;
  role?: string;
}

/**
 * Crea un JWT HS256 firmato con JWT_SECRET.
 * Scade tra 1 ora (sufficiente per qualsiasi test suite).
 */
export function makeToken(user: TestUser): string {
  return jwt.sign(
    {
      sub:   String(user.id),
      email: user.email,
      role:  user.role ?? "user",
    },
    TEST_SECRET,
    { algorithm: "HS256", expiresIn: "1h" },
  );
}

/**
 * Restituisce l'header Authorization pronto per supertest:
 *   .set(...authHeader(token))
 */
export function authHeader(token: string): [string, string] {
  return ["Authorization", `Bearer ${token}`];
}
