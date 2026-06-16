import jwt from "jsonwebtoken";

const { verify, decode } = jwt;

/**
 * Verifica crittografica dei Google ID token (Sign in with Google).
 *
 * SICUREZZA: NON ci si fida MAI del payload base64 senza verifica. Si scarica
 * il certificato pubblico di Google corrispondente al `kid` dell'header e si
 * valida firma (RS256), `aud` (= GOOGLE_CLIENT_ID) e `iss`. Senza
 * GOOGLE_CLIENT_ID configurato si fallisce *chiuso* (login Google disabilitato),
 * mai aperto.
 */

const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v1/certs";
const GOOGLE_ISSUERS: [string, string] = [
  "https://accounts.google.com",
  "accounts.google.com",
];
const CERTS_TTL_MS = 60 * 60 * 1000; // 1h

let certsCache: { keys: Record<string, string>; fetchedAt: number } | null =
  null;

async function getGoogleCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (certsCache && now - certsCache.fetchedAt < CERTS_TTL_MS) {
    return certsCache.keys;
  }
  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Google certs fetch failed: ${res.status}`);
  }
  const keys = (await res.json()) as Record<string, string>;
  certsCache = { keys, fetchedAt: now };
  return keys;
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

interface GoogleTokenPayload {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
}

/**
 * Verifica un Google ID token e restituisce l'identità *solo* se la firma,
 * l'audience e l'issuer sono validi. Restituisce `null` per qualsiasi token
 * non verificabile o se il login Google non è configurato.
 */
export async function verifyGoogleIdToken(
  idToken: string,
): Promise<GoogleIdentity | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return null; // fail-closed: login Google non configurato

  const decoded = decode(idToken, { complete: true });
  const kid =
    decoded && typeof decoded === "object" ? decoded.header?.kid : undefined;
  if (!kid) return null;

  let cert: string | undefined;
  try {
    const certs = await getGoogleCerts();
    cert = certs[kid];
  } catch {
    return null;
  }
  if (!cert) return null;

  try {
    const payload = verify(idToken, cert, {
      algorithms: ["RS256"],
      audience: clientId,
      issuer: GOOGLE_ISSUERS,
    }) as GoogleTokenPayload;

    if (!payload.sub || !payload.email) return null;

    const email = payload.email.toLowerCase();
    return {
      sub: payload.sub,
      email,
      emailVerified:
        payload.email_verified === true || payload.email_verified === "true",
      name: payload.name ?? email.split("@")[0] ?? "Utente",
      picture: payload.picture ?? null,
    };
  } catch {
    return null;
  }
}
