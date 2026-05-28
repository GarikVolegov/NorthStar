import { Resend } from "resend";
import { rootLogger } from "../middleware/logger";

const RESEND_API_KEY  = process.env.RESEND_API_KEY  ?? "";
const FROM_EMAIL      = process.env.RESEND_FROM_EMAIL ?? "NorthStar <noreply@northstar.app>";
const APP_URL         = process.env.APP_URL ?? "http://localhost:5173";

let resend: Resend | null = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
} else {
  rootLogger.warn("[email] RESEND_API_KEY non configurata — le email verranno solo loggaste");
}

// ── Shared brand styles ────────────────────────────────────────────────────────

const BASE_HTML = (body: string) => `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NorthStar</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Inter',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#0e1018;padding:24px 32px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="padding-right:10px;vertical-align:middle;">
                  <div style="width:32px;height:32px;background:#c19e4a;border-radius:50%;display:inline-block;line-height:32px;text-align:center;">
                    <span style="color:#0e1018;font-size:18px;font-weight:900;">✦</span>
                  </div>
                </td>
                <td style="vertical-align:middle;">
                  <span style="color:#c19e4a;font-size:22px;font-weight:700;letter-spacing:-0.5px;">NorthStar</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              © ${new Date().getFullYear()} NorthStar &nbsp;·&nbsp;
              <a href="${APP_URL}" style="color:#c19e4a;text-decoration:none;">northstar.app</a>
            </p>
            <p style="margin:8px 0 0;color:#d1d5db;font-size:11px;">
              Se non hai richiesto questa email, puoi ignorarla in sicurezza.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
`;

const CODE_BLOCK = (code: string) => `
  <div style="text-align:center;margin:28px 0;">
    <div style="display:inline-block;background:#0e1018;border-radius:14px;padding:20px 36px;">
      <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#c19e4a;font-family:'Courier New',monospace;">
        ${code}
      </span>
    </div>
  </div>
`;

async function send(opts: { to: string; subject: string; html: string; type: string }): Promise<void> {
  if (!resend) {
    rootLogger.info({ type: opts.type, to: opts.to }, "[email] skipped (no API key)");
    return;
  }
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to:   opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) {
      rootLogger.error({ error, type: opts.type, to: opts.to }, "[email] Resend API error");
    } else {
      rootLogger.info({ type: opts.type, to: opts.to }, "[email] sent");
    }
  } catch (err) {
    rootLogger.error({ err, type: opts.type, to: opts.to }, "[email] send failed");
  }
}

// ── sendVerificationCode ─────────────────────────────────────────────────────

export async function sendAppNotificationEmail(
  email: string,
  input: {
    userName: string;
    title: string;
    body: string;
    ctaLabel?: string;
    ctaUrl?: string;
  },
): Promise<void> {
  const ctaUrl = input.ctaUrl
    ? input.ctaUrl.startsWith("http")
      ? input.ctaUrl
      : `${APP_URL}${input.ctaUrl}`
    : null;

  await send({
    to: email,
    subject: `${input.title} - NorthStar`,
    type: "app-notification",
    html: BASE_HTML(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0e1018;">${input.title}</h2>
      <p style="margin:0 0 4px;color:#374151;font-size:15px;">Ciao <strong>${input.userName}</strong>,</p>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.5;">${input.body}</p>
      ${
        ctaUrl && input.ctaLabel
          ? `<p style="margin:24px 0 0;"><a href="${ctaUrl}" style="display:inline-block;background:#c19e4a;color:#0e1018;text-decoration:none;font-weight:700;border-radius:999px;padding:12px 18px;">${input.ctaLabel}</a></p>`
          : ""
      }
    `),
  });
}

export async function sendVerificationCode(email: string, name: string, code: string): Promise<void> {
  await send({
    to:      email,
    subject: "Verifica la tua email — NorthStar",
    type:    "verification",
    html: BASE_HTML(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0e1018;">Benvenuto su NorthStar!</h2>
      <p style="margin:0 0 4px;color:#374151;font-size:15px;">Ciao <strong>${name}</strong>,</p>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">
        Usa questo codice per verificare la tua email e completare la registrazione.
        Il codice scade tra <strong>30 minuti</strong>.
      </p>
      ${CODE_BLOCK(code)}
      <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;text-align:center;">
        Inserisci il codice nella pagina di verifica per continuare.
      </p>
    `),
  });
}

// ── send2faCode ──────────────────────────────────────────────────────────────

export async function send2faCode(email: string, name: string, code: string): Promise<void> {
  await send({
    to:      email,
    subject: "Codice di accesso — NorthStar",
    type:    "2fa",
    html: BASE_HTML(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0e1018;">Accesso in corso</h2>
      <p style="margin:0 0 4px;color:#374151;font-size:15px;">Ciao <strong>${name}</strong>,</p>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">
        Abbiamo ricevuto una richiesta di accesso al tuo account NorthStar.
        Usa questo codice per confermare la tua identità. Scade tra <strong>10 minuti</strong>.
      </p>
      ${CODE_BLOCK(code)}
      <div style="background:#fff8e6;border:1px solid #f0d080;border-radius:10px;padding:14px;margin:24px 0 0;">
        <p style="margin:0;color:#92610a;font-size:13px;">
          🔒 <strong>Non eri tu?</strong> Cambia subito la tua password — qualcuno potrebbe aver ottenuto le tue credenziali.
        </p>
      </div>
    `),
  });
}

// ── sendPasswordReset ────────────────────────────────────────────────────────

export async function sendPasswordReset(email: string, token: string): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  await send({
    to:      email,
    subject: "Reimposta la tua password — NorthStar",
    type:    "password-reset",
    html: BASE_HTML(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0e1018;">Reimposta la password</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">
        Hai richiesto di reimpostare la password del tuo account NorthStar.
        Il link scade tra <strong>60 minuti</strong>.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetUrl}"
           style="display:inline-block;background:#c19e4a;color:#0e1018;padding:14px 36px;border-radius:100px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px;">
          Reimposta password
        </a>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;word-break:break-all;">
        Oppure copia: <a href="${resetUrl}" style="color:#c19e4a;">${resetUrl}</a>
      </p>
    `),
  });
}

// ── sendWelcomeEmail ─────────────────────────────────────────────────────────

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  await send({
    to:      email,
    subject: "Email verificata — benvenuto su NorthStar! ✦",
    type:    "welcome",
    html: BASE_HTML(`
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:#f0f9f4;border-radius:50%;padding:16px;">
          <span style="font-size:32px;">🎯</span>
        </div>
      </div>
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0e1018;text-align:center;">
        Ciao ${name}, sei dentro!
      </h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;text-align:center;">
        La tua email è verificata. Inizia a esplorare il tuo percorso professionale su NorthStar.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${APP_URL}"
           style="display:inline-block;background:#c19e4a;color:#0e1018;padding:14px 36px;border-radius:100px;text-decoration:none;font-weight:700;font-size:15px;">
          Vai a NorthStar ✦
        </a>
      </div>
    `),
  });
}
