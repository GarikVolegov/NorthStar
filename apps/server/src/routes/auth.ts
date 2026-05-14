import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
const { sign } = jwt;
import { eq, and, or } from "drizzle-orm";
import crypto from "node:crypto";
import { db, usersTable, generateUsername } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

const JWT_SECRET: string = process.env.JWT_SECRET ?? "";
const DEV_MODE = process.env.NODE_ENV !== "production";

function generateToken(userId: number): string {
  return sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/* ─── POST /api/auth/register  —  registrazione ──────────────────── */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "Nome, email e password richiesti" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password deve essere almeno 6 caratteri" });
      return;
    }

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "Email già registrata" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + 30 * 60 * 1000);

    const [user] = await db
      .insert(usersTable)
      .values({
        name,
        email: email.toLowerCase(),
        passwordHash,
        verificationCode,
        verificationCodeExpires,
      })
      .returning({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        journeyType: usersTable.journeyType,
        userMode: usersTable.userMode,
        onboardingCompleted: usersTable.onboardingCompleted,
        createdAt: usersTable.createdAt,
      });

    await db
      .update(usersTable)
      .set({ username: generateUsername(user.name, user.id) })
      .where(eq(usersTable.id, user.id));

    const token = generateToken(user.id);

    const response: Record<string, unknown> = {
      ...user,
      token,
    };

    if (DEV_MODE) {
      response.devCode = verificationCode;
    }

    res.status(201).json(response);
  } catch (err) {
    req.log?.error?.({ err }, "register error");
    res.status(500).json({ error: "Errore durante la registrazione" });
  }
});

/* ─── POST /api/auth/login  —  login ─────────────────────────────── */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email e password richiesti" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Email o password errati" });
      return;
    }

    const passwordHash = user.passwordHash;
    if (!passwordHash) {
      res.status(401).json({ error: "Account registrato con Google. Accedi con Google." });
      return;
    }

    const valid = await bcrypt.compare(password, passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Email o password errati" });
      return;
    }

    if (!user.emailVerified) {
      const verificationCode = generateVerificationCode();
      const verificationCodeExpires = new Date(Date.now() + 30 * 60 * 1000);

      await db
        .update(usersTable)
        .set({ verificationCode, verificationCodeExpires })
        .where(eq(usersTable.id, user.id));

      const response: Record<string, unknown> = {
        needsVerification: true,
        email: user.email,
      };

      if (DEV_MODE) {
        response.devCode = verificationCode;
      }

      res.json(response);
      return;
    }

    const token = generateToken(user.id);

    const { passwordHash: _, verificationCode: __, verificationCodeExpires: ___, resetToken: ____, resetTokenExpires: ______, ...safeUser } = user;

    res.json({
      ...safeUser,
      token,
    });
  } catch (err) {
    req.log?.error?.({ err }, "login error");
    res.status(500).json({ error: "Errore durante il login" });
  }
});

/* ─── POST /api/auth/verify-email  —  verifica email ─────────────── */
router.post("/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({ error: "Email e codice richiesti" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.email, email.toLowerCase()),
          eq(usersTable.verificationCode, code),
        ),
      )
      .limit(1);

    if (!user) {
      res.status(400).json({ error: "Codice non valido" });
      return;
    }

    if (user.verificationCodeExpires && new Date() > user.verificationCodeExpires) {
      res.status(400).json({ error: "Codice scaduto. Richiedine uno nuovo." });
      return;
    }

    await db
      .update(usersTable)
      .set({
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    const token = generateToken(user.id);

    const { passwordHash: _, verificationCode: __, verificationCodeExpires: ___, resetToken: ____, resetTokenExpires: ______, ...safeUser } = user;

    res.json({
      ...safeUser,
      emailVerified: true,
      token,
    });
  } catch (err) {
    req.log?.error?.({ err }, "verify-email error");
    res.status(500).json({ error: "Errore durante la verifica" });
  }
});

/* ─── POST /api/auth/resend-verification  —  rimanda codice ──────── */
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Email richiesta" });
      return;
    }

    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + 30 * 60 * 1000);

    await db
      .update(usersTable)
      .set({ verificationCode, verificationCodeExpires })
      .where(eq(usersTable.email, email.toLowerCase()));

    const response: Record<string, unknown> = {};

    if (DEV_MODE) {
      response.devCode = verificationCode;
    }

    res.json(response);
  } catch (err) {
    req.log?.error?.({ err }, "resend-verification error");
    res.status(500).json({ error: "Errore durante l'invio del codice" });
  }
});

/* ─── POST /api/auth/forgot-password  —  richiesta reset password ─── */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Email richiesta" });
      return;
    }

    const resetToken = crypto.randomUUID();
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

    await db
      .update(usersTable)
      .set({ resetToken, resetTokenExpires })
      .where(eq(usersTable.email, email.toLowerCase()));

    const response: Record<string, unknown> = {};

    if (DEV_MODE) {
      response.devToken = resetToken;
    }

    res.json(response);
  } catch (err) {
    req.log?.error?.({ err }, "forgot-password error");
    res.status(500).json({ error: "Errore durante la richiesta" });
  }
});

/* ─── POST /api/auth/reset-password  —  cambio password ──────────── */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ error: "Token e nuova password richiesti" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "Password deve essere almeno 6 caratteri" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.resetToken, token))
      .limit(1);

    if (!user) {
      res.status(400).json({ error: "Token non valido" });
      return;
    }

    if (user.resetTokenExpires && new Date() > user.resetTokenExpires) {
      res.status(400).json({ error: "Token scaduto. Richiedine uno nuovo." });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db
      .update(usersTable)
      .set({
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "reset-password error");
    res.status(500).json({ error: "Errore durante il reset della password" });
  }
});

/* ─── POST /api/auth/google-token  —  login con Google ────────────── */
router.post("/google-token", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      res.status(400).json({ error: "Credential richiesto" });
      return;
    }

    const googlePayload = JSON.parse(
      Buffer.from(credential.split(".")[1], "base64").toString(),
    ) as {
      sub: string;
      email: string;
      name: string;
      picture?: string;
    };

    const googleId = googlePayload.sub;
    const email = googlePayload.email.toLowerCase();
    const name = googlePayload.name;
    const avatarUrl = googlePayload.picture ?? null;

    let [existing] = await db
      .select()
      .from(usersTable)
      .where(
        or(
          eq(usersTable.googleId, googleId),
          eq(usersTable.email, email),
        ),
      )
      .limit(1);

    if (existing) {
      if (!existing.googleId) {
        await db
          .update(usersTable)
          .set({
            googleId,
            emailVerified: true,
            avatarUrl: avatarUrl ?? existing.avatarUrl,
            updatedAt: new Date(),
          })
          .where(eq(usersTable.id, existing.id));
      }
    } else {
      const [created] = await db
        .insert(usersTable)
        .values({
          name,
          email,
          googleId,
          avatarUrl,
          emailVerified: true,
        })
        .returning({ id: usersTable.id });

      await db
        .update(usersTable)
        .set({ username: generateUsername(name, created.id) })
        .where(eq(usersTable.id, created.id));
    }

    const [user] = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        testSessionId: usersTable.testSessionId,
        emailVerified: usersTable.emailVerified,
        stripeSubscriptionId: usersTable.stripeSubscriptionId,
        workPreference: usersTable.workPreference,
        autonomyPreference: usersTable.autonomyPreference,
        stabilityPreference: usersTable.stabilityPreference,
        timezone: usersTable.timezone,
        userMode: usersTable.userMode,
        journeyType: usersTable.journeyType,
        avatarUrl: usersTable.avatarUrl,
        isPublic: usersTable.isPublic,
        isAffiliate: usersTable.isAffiliate,
        onboardingCompleted: usersTable.onboardingCompleted,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    const token = generateToken(user.id);

    res.json({
      ...user,
      token,
    });
  } catch (err) {
    req.log?.error?.({ err }, "google-token error");
    res.status(500).json({ error: "Errore durante l'accesso con Google" });
  }
});

/* ─── POST /api/auth/refresh  —  refresh token ───────────────────── */
router.post("/refresh", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token mancante" });
      return;
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    const newToken = generateToken(payload.userId);

    res.json({ token: newToken });
  } catch {
    res.status(401).json({ error: "Token non valido" });
  }
});

/* ─── GET /api/auth/me  —  profilo corrente ──────────────────────── */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        testSessionId: usersTable.testSessionId,
        emailVerified: usersTable.emailVerified,
        stripeSubscriptionId: usersTable.stripeSubscriptionId,
        workPreference: usersTable.workPreference,
        autonomyPreference: usersTable.autonomyPreference,
        stabilityPreference: usersTable.stabilityPreference,
        timezone: usersTable.timezone,
        userMode: usersTable.userMode,
        journeyType: usersTable.journeyType,
        avatarUrl: usersTable.avatarUrl,
        isPublic: usersTable.isPublic,
        isAffiliate: usersTable.isAffiliate,
        onboardingCompleted: usersTable.onboardingCompleted,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.id))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }

    res.json(user);
  } catch (err) {
    req.log?.error?.({ err }, "auth/me error");
    res.status(500).json({ error: "Errore nel caricamento del profilo" });
  }
});

export default router;
