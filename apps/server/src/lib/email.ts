import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "NorthStar <noreply@northstar.app>";
const APP_URL = process.env.APP_URL ?? "http://localhost:5173";

let resend: Resend | null = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
}

function logFallback(type: string, email: string, ...args: unknown[]) {
  console.log(`[email] ${type} -> ${email}`, ...args);
}

export async function sendVerificationCode(email: string, name: string, code: string): Promise<void> {
  if (!resend) {
    logFallback("sendVerificationCode skipped (no Resend key)", email, { code });
    return;
  }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Il tuo codice di verifica — NorthStar",
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width:480px; margin:0 auto; padding:24px;">
          <h2 style="color:#0d1520;">Benvenuto su NorthStar!</h2>
          <p style="color:#374151;">Ciao ${name},</p>
          <p style="color:#374151;">Usa questo codice per verificare la tua email:</p>
          <div style="text-align:center; margin:32px 0;">
            <span style="font-size:36px; font-weight:700; letter-spacing:8px; color:#2563eb; background:#f0f5ff; padding:16px 24px; border-radius:12px;">
              ${code}
            </span>
          </div>
          <p style="color:#6b7280; font-size:14px;">Il codice scade tra 30 minuti.</p>
          <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />
          <p style="color:#9ca3af; font-size:12px;">Se non hai creato un account, ignora questa email.</p>
        </div>
      `,
    });
    logFallback("sendVerificationCode sent", email);
  } catch (err) {
    console.error("[email] sendVerificationCode error:", err);
  }
}

export async function sendPasswordReset(email: string, token: string): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  if (!resend) {
    logFallback("sendPasswordReset skipped (no Resend key)", email, { resetUrl });
    return;
  }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Reimposta la tua password — NorthStar",
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width:480px; margin:0 auto; padding:24px;">
          <h2 style="color:#0d1520;">Richiesta di reset password</h2>
          <p style="color:#374151;">Hai richiesto di reimpostare la password.</p>
          <p style="color:#374151;">Clicca il pulsante qui sotto per procedere:</p>
          <div style="text-align:center; margin:32px 0;">
            <a href="${resetUrl}" style="display:inline-block; background:#2563eb; color:#fff; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:600;">
              Reimposta password
            </a>
          </div>
          <p style="color:#6b7280; font-size:14px;">Il link scade tra 60 minuti.</p>
          <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />
          <p style="color:#9ca3af; font-size:12px;">Se non hai richiesto il reset, ignora questa email.</p>
        </div>
      `,
    });
    logFallback("sendPasswordReset sent", email);
  } catch (err) {
    console.error("[email] sendPasswordReset error:", err);
  }
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  if (!resend) {
    logFallback("sendWelcomeEmail skipped (no Resend key)", email);
    return;
  }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Email verificata! — NorthStar",
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width:480px; margin:0 auto; padding:24px;">
          <h2 style="color:#0d1520;">Email verificata ✅</h2>
          <p style="color:#374151;">Ciao ${name},</p>
          <p style="color:#374151;">La tua email è stata verificata con successo. Ora puoi esplorare NorthStar e scoprire il tuo percorso professionale.</p>
          <div style="text-align:center; margin:32px 0;">
            <a href="${APP_URL}" style="display:inline-block; background:#2563eb; color:#fff; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:600;">
              Vai a NorthStar
            </a>
          </div>
        </div>
      `,
    });
    logFallback("sendWelcomeEmail sent", email);
  } catch (err) {
    console.error("[email] sendWelcomeEmail error:", err);
  }
}
