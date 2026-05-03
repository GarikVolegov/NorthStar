import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { sendVerificationEmail, sendResetEmail, sendPasswordChangedEmail } from "../lib/email";
import { signToken, authMiddleware } from "../lib/auth-jwt.js";
import { rateLimit } from "express-rate-limit";

function makeAuthLimiter(max: number, windowMs = 60_000, message = "Troppi tentativi. Riprova tra un minuto.") {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
    skipSuccessfulRequests: false,
  });
}

const loginLimiter = makeAuthLimiter(5, 60_000, "Troppi tentativi di accesso. Riprova tra un minuto.");
const registerLimiter = makeAuthLimiter(5, 60_000, "Troppi tentativi di registrazione. Riprova tra un minuto.");
const forgotLimiter = makeAuthLimiter(5, 60_000, "Troppi tentativi. Riprova tra un minuto.");
const verifyLimiter = makeAuthLimiter(5, 60_000, "Troppi tentativi di verifica. Riprova tra un minuto.");
const resendLimiter = makeAuthLimiter(3, 60_000, "Hai richiesto troppi codici. Riprova tra un minuto.");

const router: IRouter = Router();

const RegisterBody = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  testSessionId: z.number().optional(),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const VerifyEmailBody = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const ResendBody = z.object({
  email: z.string().email(),
});

const ForgotPasswordBody = z.object({
  email: z.string().email(),
});

const ResetPasswordBody = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6),
});

function safeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    testSessionId: user.testSessionId,
    emailVerified: user.emailVerified,
    stripeSubscriptionId: user.stripeSubscriptionId,
    workPreference: user.workPreference,
    autonomyPreference: user.autonomyPreference,
    stabilityPreference: user.stabilityPreference,
    timezone: user.timezone,
    createdAt: user.createdAt.toISOString(),
  };
}

function generateCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function getAppBaseUrl(): string {
  const replitDomains = process.env.REPLIT_DOMAINS;
  const replitDomain = replitDomains ? replitDomains.split(",")[0].trim() : null;
  const raw =
    process.env.APP_BASE_URL ??
    process.env.PUBLIC_APP_URL ??
    process.env.APP_URL ??
    (replitDomain ? `https://${replitDomain}` : null) ??
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null) ??
    "https://northstar.app";
  return raw.startsWith("http://") || raw.startsWith("https://") ? raw.replace(/\/$/, "") : `https://${raw.replace(/^\/+/, "").replace(/\/$/, "")}`;
}

const isDevMode = !process.env.RESEND_API_KEY;

async function trySendVerificationEmail(
  email: string,
  name: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await sendVerificationEmail(email, name, code);
    return { ok: true };
  } catch (err) {
    console.error("[auth] verification email failed", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

router.post("/auth/register", registerLimiter, async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }

  const { name, email, password, testSessionId } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(409).json({ error: "Email già registrata" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const verificationCode = generateCode();
  const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

  await db.insert(usersTable).values({
    name,
    email,
    passwordHash,
    testSessionId: testSessionId ?? null,
    emailVerified: false,
    verificationCode,
    verificationCodeExpires,
  });

  const sendResult = await trySendVerificationEmail(email, name, verificationCode);

  const body: Record<string, unknown> = {
    message: sendResult.ok
      ? "Registrazione completata. Controlla la tua email per il codice di verifica."
      : "Registrazione completata, ma non siamo riusciti a inviare l'email di verifica. Usa il pulsante 'Invia di nuovo'.",
    emailSent: sendResult.ok,
  };
  if (!sendResult.ok && sendResult.error) body.emailError = sendResult.error;
  if (isDevMode) body.devCode = verificationCode;

  res.status(201).json(body);
});

router.post("/auth/verify-email", verifyLimiter, async (req, res): Promise<void> => {
  const parsed = VerifyEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }

  const { email, code } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(404).json({ error: "Account non trovato" });
    return;
  }

  if (user.emailVerified) {
    res.status(400).json({ error: "Email già verificata. Accedi normalmente." });
    return;
  }

  if (user.verificationCode !== code) {
    res.status(400).json({ error: "Codice non valido" });
    return;
  }

  if (!user.verificationCodeExpires || user.verificationCodeExpires < new Date()) {
    res.status(400).json({ error: "Codice scaduto. Richiedi un nuovo codice." });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ emailVerified: true, verificationCode: null, verificationCodeExpires: null })
    .where(eq(usersTable.id, user.id))
    .returning();

  res.json({ ...safeUser(updated), token: signToken(updated.id) });
});

router.post("/auth/resend-verification", resendLimiter, async (req, res): Promise<void> => {
  const parsed = ResendBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }

  const { email } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!user || user.emailVerified) {
    res.json({ message: "Se l'email esiste, riceverai un nuovo codice." });
    return;
  }

  const verificationCode = generateCode();
  const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

  await db
    .update(usersTable)
    .set({ verificationCode, verificationCodeExpires })
    .where(eq(usersTable.id, user.id));

  const sendResult = await trySendVerificationEmail(email, user.name, verificationCode);

  const body: Record<string, unknown> = {
    message: sendResult.ok
      ? "Nuovo codice inviato. Controlla la tua email."
      : "Non siamo riusciti a inviare l'email. Riprova tra qualche minuto.",
    emailSent: sendResult.ok,
  };
  if (!sendResult.ok && sendResult.error) body.emailError = sendResult.error;
  if (isDevMode) body.devCode = verificationCode;

  res.json(body);
});

router.post("/auth/login", loginLimiter, async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!user) {
    res.status(401).json({ error: "Email o password non corretti" });
    return;
  }

  if (!user.passwordHash) {
    res.status(401).json({ error: "Account creato senza password. Usa la registrazione." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Email o password non corretti" });
    return;
  }

  if (!user.emailVerified) {
    const newCode = generateCode();
    const newExpires = new Date(Date.now() + 15 * 60 * 1000);
    await db
      .update(usersTable)
      .set({ verificationCode: newCode, verificationCodeExpires: newExpires })
      .where(eq(usersTable.id, user.id));
    const sendResult = await trySendVerificationEmail(email, user.name, newCode);

    const body: Record<string, unknown> = {
      error: sendResult.ok
        ? "Email non verificata. Ti abbiamo inviato un nuovo codice."
        : "Email non verificata. Non siamo riusciti a inviare un nuovo codice — riprova dalla schermata di verifica.",
      needsVerification: true,
      email,
      emailSent: sendResult.ok,
    };
    if (!sendResult.ok && sendResult.error) body.emailError = sendResult.error;
    if (isDevMode) body.devCode = newCode;
    res.status(403).json(body);
    return;
  }

  res.json({ ...safeUser(user), token: signToken(user.id) });
});

router.get("/auth/me", authMiddleware, async (_req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Utente non trovato" });
    return;
  }
  res.json(safeUser(user));
});

router.post("/auth/forgot-password", forgotLimiter, async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }

  const { email } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  const body: Record<string, unknown> = {
    message: "Se l'email esiste, riceverai un link per reimpostare la password.",
  };

  if (user) {
    const resetToken = crypto.randomUUID();
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

    await db
      .update(usersTable)
      .set({ resetToken, resetTokenExpires })
      .where(eq(usersTable.id, user.id));

    const resetUrl = `${getAppBaseUrl()}/reset-password?token=${resetToken}`;
    let emailSent = true;
    let emailError: string | undefined;
    try {
      await sendResetEmail(email, resetUrl);
    } catch (err) {
      emailSent = false;
      emailError = err instanceof Error ? err.message : String(err);
      console.error("[auth] reset email failed", err);
    }

    body.emailSent = emailSent;
    if (!emailSent && emailError) body.emailError = emailError;
    if (isDevMode) body.devToken = resetToken;
  }

  res.json(body);
});

router.post("/auth/reset-password", forgotLimiter, async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }

  const { token, newPassword } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.resetToken, token));

  if (!user) {
    res.status(400).json({ error: "Link non valido o già utilizzato" });
    return;
  }

  if (!user.resetTokenExpires || user.resetTokenExpires < new Date()) {
    res.status(400).json({ error: "Link scaduto. Richiedi un nuovo reset." });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await db
    .update(usersTable)
    .set({ passwordHash, resetToken: null, resetTokenExpires: null })
    .where(eq(usersTable.id, user.id));

  try {
    await sendPasswordChangedEmail(user.email, user.name);
  } catch (err) {
    console.error("[auth] password changed confirmation email failed", err);
  }

  res.json({ message: "Password reimpostata con successo." });
});

export default router;
