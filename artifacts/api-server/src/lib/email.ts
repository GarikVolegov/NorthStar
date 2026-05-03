const RESEND_API_KEY = process.env.RESEND_API_KEY;

const FROM = process.env.EMAIL_FROM ?? "NorthStar <onboarding@resend.dev>";

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY non configurato — email non inviata a:", to);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[email] Resend error:", res.status, body);
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }

  console.log("[email] Inviata a:", to, "—", subject);
}

export async function sendVerificationEmail(to: string, name: string, code: string): Promise<void> {
  const html = `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#1a3a2a;padding:24px 28px;">
      <p style="margin:0;color:#86efac;font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;">NorthStar</p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">Conferma il tuo account</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 8px;color:#374151;font-size:16px;">Ciao <strong>${name}</strong>,</p>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">
        Usa il codice qui sotto per confermare il tuo account NorthStar.<br>
        Il codice è valido per <strong>15 minuti</strong>.
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
        <p style="margin:0 0 8px;color:#15803d;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;">Codice di verifica</p>
        <p style="margin:0;letter-spacing:10px;font-size:36px;font-weight:700;color:#1a3a2a;font-family:monospace;">${code}</p>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
        Se non hai creato un account NorthStar, puoi ignorare questa email in sicurezza.
      </p>
    </div>
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:14px 28px;">
      <p style="margin:0;color:#9ca3af;font-size:11px;">© NorthStar · La tua bussola professionale</p>
    </div>
  </div>
</body>
</html>`;

  await sendEmail(to, "Conferma il tuo account NorthStar", html);
}

export async function sendResetEmail(to: string, resetUrl: string): Promise<void> {
  const html = `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#1a3a2a;padding:24px 28px;">
      <p style="margin:0;color:#86efac;font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;">NorthStar</p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">Reimposta la password</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
        Abbiamo ricevuto una richiesta di reset della password per il tuo account NorthStar.<br>
        Clicca sul pulsante qui sotto per sceglierne una nuova.
      </p>
      <p style="margin:0 0 24px;color:#6b7280;font-size:13px;">Il link è valido per <strong>1 ora</strong>.</p>
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${resetUrl}"
           style="display:inline-block;background:#1a3a2a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:999px;font-size:15px;font-weight:600;">
          Reimposta Password →
        </a>
      </div>
      <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;">Oppure copia e incolla questo link nel browser:</p>
      <p style="margin:0;color:#15803d;font-size:11px;word-break:break-all;font-family:monospace;">${resetUrl}</p>
    </div>
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:14px 28px;">
      <p style="margin:0;color:#9ca3af;font-size:11px;">
        Se non hai richiesto il reset, ignora questa email. La tua password rimane invariata.<br>
        © NorthStar · La tua bussola professionale
      </p>
    </div>
  </div>
</body>
</html>`;

  await sendEmail(to, "Reimposta la tua password NorthStar", html);
}

export interface StaleInterview {
  id: number;
  company: string;
  role: string;
  updatedAt: Date;
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

export async function sendPasswordChangedEmail(to: string, name: string): Promise<void> {
  const html = `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#1a3a2a;padding:24px 28px;">
      <p style="margin:0;color:#86efac;font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;">NorthStar</p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">Password reimpostata</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 8px;color:#374151;font-size:16px;">Ciao <strong>${name}</strong>,</p>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">
        La tua password NorthStar è stata cambiata con successo.
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:24px;">
        <p style="margin:0;color:#15803d;font-size:14px;line-height:1.6;">
          ✓ Se hai effettuato tu questa modifica, puoi ignorare questa email in sicurezza.<br>
          ⚠️ Se <strong>non</strong> hai cambiato la password, <strong>contatta subito il nostro supporto</strong>.
        </p>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
        Per motivi di sicurezza, non condivideremo mai la tua password via email. Se hai domande, rispondi a questa email.
      </p>
    </div>
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:14px 28px;">
      <p style="margin:0;color:#9ca3af;font-size:11px;">© NorthStar · La tua bussola professionale</p>
    </div>
  </div>
</body>
</html>`;

  await sendEmail(to, "La tua password NorthStar è stata reimpostata", html);
}

export async function sendInterviewReminderEmail(
  to: string,
  name: string,
  apps: StaleInterview[],
): Promise<void> {
  const APP_URL = process.env.APP_URL ?? "https://northstar.app";
  const count = apps.length;

  const appRows = apps.map((a) => {
    const days = daysSince(a.updatedAt);
    return `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;">
          <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${a.company}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">${a.role}</p>
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;text-align:right;white-space:nowrap;">
          <span style="display:inline-block;background:#fef3c7;color:#92400e;border:1px solid #fde68a;border-radius:999px;font-size:11px;font-weight:600;padding:2px 10px;">
            ${days} giorni fa
          </span>
        </td>
      </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">

    <div style="background:#1a3a2a;padding:24px 28px;">
      <p style="margin:0;color:#86efac;font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;">NorthStar</p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">🎤 Colloqui in attesa</h1>
    </div>

    <div style="padding:28px 28px 8px;">
      <p style="margin:0 0 6px;color:#374151;font-size:15px;">Ciao <strong>${name}</strong>,</p>
      <p style="margin:0 0 20px;color:#6b7280;font-size:14px;line-height:1.6;">
        Hai <strong>${count} colloquio${count > 1 ? "i" : ""}</strong> in stato "Colloquio" senza aggiornamenti
        da più di 7 giorni. È il momento di aggiornare il loro stato!
      </p>

      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:24px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:10px 14px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Azienda / Ruolo</th>
            <th style="padding:10px 14px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Inattività</th>
          </tr>
        </thead>
        <tbody>${appRows}</tbody>
      </table>

      <div style="text-align:center;margin-bottom:28px;">
        <a href="${APP_URL}/candidature"
           style="display:inline-block;background:#1a3a2a;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:999px;font-size:14px;font-weight:600;">
          Aggiorna le candidature →
        </a>
      </div>

      <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
        Ricevi questa email perché hai candidature in stato "Colloquio" da oltre 7 giorni su NorthStar.<br>
        Aggiorna lo stato per smettere di ricevere questi promemoria.
      </p>
    </div>

    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:14px 28px;">
      <p style="margin:0;color:#9ca3af;font-size:11px;">© NorthStar · La tua bussola professionale</p>
    </div>

  </div>
</body>
</html>`;

  await sendEmail(to, `🎤 Hai ${count} colloquio${count > 1 ? "i" : ""} da aggiornare — NorthStar`, html);
}
