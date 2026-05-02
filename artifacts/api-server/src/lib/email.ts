import nodemailer from "nodemailer";

function getTransport() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return null;
}

const FROM = process.env.SMTP_FROM || "NorthStar <noreply@northstar.app>";

export async function sendVerificationEmail(to: string, name: string, code: string): Promise<void> {
  const transport = getTransport();
  if (!transport) return;
  await transport.sendMail({
    from: FROM,
    to,
    subject: "Conferma il tuo account NorthStar ✦",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
        <h2 style="font-size:24px;font-weight:700;margin-bottom:8px;">Benvenuto su NorthStar, ${name}!</h2>
        <p style="color:#555;margin-bottom:24px;">Usa il codice qui sotto per confermare il tuo account. Il codice è valido per 15 minuti.</p>
        <div style="background:#f5f5f5;border-radius:12px;padding:24px;text-align:center;letter-spacing:8px;font-size:32px;font-weight:700;margin-bottom:24px;">
          ${code}
        </div>
        <p style="color:#888;font-size:13px;">Se non hai creato un account NorthStar, ignora questa email.</p>
      </div>
    `,
  });
}

export async function sendResetEmail(to: string, resetUrl: string): Promise<void> {
  const transport = getTransport();
  if (!transport) return;
  await transport.sendMail({
    from: FROM,
    to,
    subject: "Reimposta la tua password NorthStar",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
        <h2 style="font-size:24px;font-weight:700;margin-bottom:8px;">Reimposta la password</h2>
        <p style="color:#555;margin-bottom:24px;">Clicca sul pulsante qui sotto per scegliere una nuova password. Il link è valido per 1 ora.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#2d6a4f;color:#fff;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600;margin-bottom:24px;">
          Reimposta Password
        </a>
        <p style="color:#888;font-size:13px;">Se non hai richiesto un reset, ignora questa email. La tua password rimane invariata.</p>
      </div>
    `,
  });
}
