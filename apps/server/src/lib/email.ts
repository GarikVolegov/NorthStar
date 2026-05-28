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

// ── sendRoutineEmail ─────────────────────────────────────────────────────────

/** Converte markdown semplice in HTML per email.
 *  Supporta: **bold**, *italic*, ## titoli, - bullet list, `code`. */
function markdownToEmailHtml(md: string): string {
  return md
    // Titoli h3/h2
    .replace(/^### (.+)$/gm, '<h3 style="margin:16px 0 6px;font-size:15px;font-weight:700;color:#0e1018;">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 style="margin:20px 0 8px;font-size:17px;font-weight:700;color:#0e1018;">$1</h2>')
    // Bold e italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    // Code inline
    .replace(/`([^`]+)`/g, '<code style="background:#f3f4f6;padding:1px 5px;border-radius:4px;font-family:monospace;font-size:13px;">$1</code>')
    // Bullet list — raggruppa linee con "- " in <ul>
    .replace(/((?:^- .+\n?)+)/gm, (block) => {
      const items = block
        .split("\n")
        .filter((l) => l.startsWith("- "))
        .map((l) => `<li style="margin:4px 0;color:#374151;">${l.slice(2)}</li>`)
        .join("");
      return `<ul style="margin:8px 0;padding-left:20px;">${items}</ul>`;
    })
    // Paragrafi (righe non vuote non ancora in tag)
    .replace(/^(?!<[hul]|$)(.+)$/gm, '<p style="margin:6px 0;color:#374151;font-size:14px;line-height:1.6;">$1</p>')
    // Newline doppi → spazio
    .replace(/\n{2,}/g, "");
}

export interface RoutineEmailData {
  userName:     string;
  routineName:  string;
  routineType:  string;
  routineEmoji: string;
  title:        string;
  body:         string;
  ctaLabel?:    string;
  ctaTarget?:   string;
}

export async function sendRoutineEmail(
  toEmail: string,
  data: RoutineEmailData,
): Promise<void> {
  const ctaUrl  = data.ctaTarget
    ? (data.ctaTarget.startsWith("http") ? data.ctaTarget : `${APP_URL}${data.ctaTarget}`)
    : `${APP_URL}/routines`;

  const ctaButton = `
    <div style="text-align:center;margin:24px 0 8px;">
      <a href="${ctaUrl}"
         style="display:inline-block;background:#c19e4a;color:#0e1018;padding:12px 32px;
                border-radius:100px;text-decoration:none;font-weight:700;font-size:14px;
                letter-spacing:0.3px;">
        ${data.ctaLabel ?? "Vedi risultati"} →
      </a>
    </div>
  `;

  const bodyHtml = markdownToEmailHtml(data.body);

  await send({
    to:      toEmail,
    subject: `${data.routineEmoji} ${data.title}`,
    type:    "routine",
    html: BASE_HTML(`
      <!-- Routine badge -->
      <div style="margin-bottom:20px;">
        <span style="display:inline-block;background:#f3f4f6;border-radius:100px;
                     padding:4px 12px;font-size:12px;font-weight:600;color:#6b7280;
                     letter-spacing:0.4px;text-transform:uppercase;">
          ${data.routineEmoji} ${data.routineName}
        </span>
      </div>

      <!-- Titolo -->
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0e1018;line-height:1.3;">
        ${data.title}
      </h2>

      <!-- Separatore -->
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;" />

      <!-- Corpo -->
      <div style="font-size:14px;line-height:1.7;color:#374151;">
        ${bodyHtml}
      </div>

      <!-- CTA -->
      ${ctaButton}

      <!-- Link routines -->
      <p style="margin:20px 0 0;text-align:center;font-size:12px;color:#9ca3af;">
        Gestisci le tue routine su
        <a href="${APP_URL}/routines" style="color:#c19e4a;text-decoration:none;">NorthStar</a>
      </p>
    `),
  });
}

// ── sendWelcomeEmail ─────────────────────────────────────────────────────────

export interface AppNotificationEmailData {
  userName: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

export async function sendAppNotificationEmail(
  toEmail: string,
  data: AppNotificationEmailData,
): Promise<void> {
  const ctaUrl = data.ctaUrl
    ? (data.ctaUrl.startsWith("http") ? data.ctaUrl : `${APP_URL}${data.ctaUrl}`)
    : APP_URL;
  const ctaButton = data.ctaLabel
    ? `
      <div style="text-align:center;margin:24px 0 8px;">
        <a href="${ctaUrl}"
           style="display:inline-block;background:#c19e4a;color:#0e1018;padding:12px 32px;
                  border-radius:100px;text-decoration:none;font-weight:700;font-size:14px;">
          ${data.ctaLabel}
        </a>
      </div>
    `
    : "";

  await send({
    to: toEmail,
    subject: data.title,
    type: "app-notification",
    html: BASE_HTML(`
      <p style="margin:0 0 4px;color:#374151;font-size:15px;">Ciao <strong>${data.userName}</strong>,</p>
      <h2 style="margin:0 0 14px;font-size:20px;font-weight:700;color:#0e1018;line-height:1.3;">
        ${data.title}
      </h2>
      <p style="margin:0;color:#6b7280;font-size:15px;line-height:1.65;">
        ${data.body}
      </p>
      ${ctaButton}
    `),
  });
}

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

export interface MonthlyRitualVigilEmailData {
  userName: string;
  ritualUrl: string;
}

export async function sendMonthlyRitualVigilEmail(
  toEmail: string,
  data: MonthlyRitualVigilEmailData,
): Promise<void> {
  const ritualUrl = data.ritualUrl.startsWith("http") ? data.ritualUrl : `${APP_URL}${data.ritualUrl}`;

  await send({
    to: toEmail,
    subject: "Domani e' la Notte della Fondazione",
    type: "monthly-ritual-vigil",
    html: BASE_HTML(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0e1018;">
        Domani si apre la Notte della Fondazione
      </h2>
      <p style="margin:0 0 12px;color:#374151;font-size:15px;">Ciao <strong>${data.userName}</strong>,</p>
      <p style="margin:0 0 18px;color:#6b7280;font-size:15px;line-height:1.65;">
        Il 7 del mese NorthStar accende la tua Rotta del Mese: un piccolo rito operativo per tornare al centro
        e scegliere una Scintilla 24h da completare.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${ritualUrl}"
           style="display:inline-block;background:#c19e4a;color:#0e1018;padding:14px 34px;border-radius:100px;text-decoration:none;font-weight:700;font-size:15px;">
          Apri la Notte della Fondazione
        </a>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
        La Rotta sara' attiva domani per tutta la giornata.
      </p>
    `),
  });
}
