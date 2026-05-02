const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL    = process.env.ADMIN_NOTIFICATION_EMAIL;
const FROM_EMAIL     = process.env.NOTIFY_FROM_EMAIL ?? "NorthStar <notifiche@northstar.app>";

export interface LeadPayload {
  id: number;
  institutionName: string;
  partnerType: string;
  contactName: string;
  email: string;
  phone?: string | null;
  message?: string | null;
  estimatedUsers?: string | null;
  createdAt: string;
}

const PARTNER_LABELS: Record<string, string> = {
  scuola_media:      "Scuola media",
  scuola_superiore:  "Scuola superiore",
  universita:        "Università",
  agenzia_lavoro:    "Agenzia per il lavoro",
  centro_formazione: "Centro di formazione",
  ente_pubblico:     "Ente pubblico",
  orientatore:       "Orientatore / Consulente",
  altro:             "Altro",
};

function buildHtml(lead: LeadPayload): string {
  const tipo = PARTNER_LABELS[lead.partnerType] ?? lead.partnerType;
  const date = new Date(lead.createdAt).toLocaleString("it-IT", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const row = (label: string, value: string | null | undefined) =>
    value
      ? `<tr>
           <td style="padding:8px 12px;color:#6b7280;font-size:13px;white-space:nowrap;">${label}</td>
           <td style="padding:8px 12px;color:#111827;font-size:13px;font-weight:500;">${value}</td>
         </tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">

    <!-- Header -->
    <div style="background:#1a3a2a;padding:24px 28px;">
      <p style="margin:0;color:#86efac;font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;">NorthStar · Programma Affiliazione</p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">Nuova richiesta di partnership</h1>
    </div>

    <!-- Lead ID pill -->
    <div style="padding:16px 28px 0;">
      <span style="display:inline-block;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;border-radius:999px;font-size:12px;font-weight:600;padding:4px 12px;">
        Lead #${lead.id} · ${tipo}
      </span>
    </div>

    <!-- Table -->
    <div style="padding:16px 28px 8px;">
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
        <tbody>
          ${row("Istituzione", lead.institutionName)}
          ${row("Tipo partner", tipo)}
          ${row("Referente", lead.contactName)}
          ${row("Email", `<a href="mailto:${lead.email}" style="color:#15803d;">${lead.email}</a>`)}
          ${row("Telefono", lead.phone ? `<a href="tel:${lead.phone}" style="color:#15803d;">${lead.phone}</a>` : null)}
          ${row("Utenti stimati", lead.estimatedUsers)}
          ${row("Data richiesta", date)}
        </tbody>
      </table>
    </div>

    <!-- Message -->
    ${lead.message ? `
    <div style="padding:12px 28px 8px;">
      <p style="margin:0 0 8px;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;">Messaggio</p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;color:#374151;font-size:14px;line-height:1.6;white-space:pre-wrap;">${lead.message}</div>
    </div>` : ""}

    <!-- CTA -->
    <div style="padding:20px 28px 28px;">
      <a href="mailto:${lead.email}?subject=Partnership NorthStar — ${encodeURIComponent(lead.institutionName)}"
         style="display:inline-block;background:#1a3a2a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:600;">
        Rispondi via email →
      </a>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:14px 28px;">
      <p style="margin:0;color:#9ca3af;font-size:11px;">
        Gestisci tutti i lead su <a href="https://northstar.app/admin/affiliazione" style="color:#15803d;">northstar.app/admin/affiliazione</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function notifyNewLead(lead: LeadPayload): Promise<void> {
  if (!RESEND_API_KEY || !ADMIN_EMAIL) return;

  const tipo = PARTNER_LABELS[lead.partnerType] ?? lead.partnerType;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ADMIN_EMAIL],
        subject: `[NorthStar] Nuova richiesta affiliazione: ${lead.institutionName} (${tipo})`,
        html: buildHtml(lead),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[notify-email] Resend error:", res.status, body);
    } else {
      console.log(`[notify-email] Email inviata per lead #${lead.id}`);
    }
  } catch (err) {
    console.error("[notify-email] Fetch error:", err);
  }
}
