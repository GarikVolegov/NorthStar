/**
 * buildDigestEmail — HTML email template for the weekly growth digest.
 *
 * Fully inline-styled for maximum email client compatibility.
 * Tested against Gmail, Apple Mail, Outlook (via Resend preview).
 *
 * @param data  DigestEmailData
 * @returns     { subject: string; html: string }
 */

export interface DigestEmailData {
  userName: string;
  weekLabel: string;           // e.g. "5–11 Maggio"
  totalSessions: number;
  totalMessages: number;
  avgConfidence: number | null; // 0-1
  streakDays: number;
  topTopics: string[];          // up to 5
  patternHighlight: string;     // one key pattern description
  digestBody: string;           // GPT-generated personalised paragraph
  ctaUrl: string;               // link back to app
}

export function buildDigestEmail(data: DigestEmailData): { subject: string; html: string } {
  const subject = `🌟 Il tuo digest settimanale NorthStar — ${data.weekLabel}`;

  const confPct = data.avgConfidence != null
    ? `${Math.round(data.avgConfidence * 100)}%`
    : "—";

  const topicsPills = data.topTopics
    .map(
      (t) =>
        `<span style="display:inline-block;background:#ede9fe;color:#5b21b6;border-radius:999px;padding:4px 12px;margin:3px 3px;font-size:13px;">${t}</span>`,
    )
    .join("");

  const html = /* html */ `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f8f7ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7ff;padding:32px 0;">
    <tr><td align="center">

    <!-- Card -->
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);max-width:560px;width:100%;">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
          <div style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
            <span style="font-size:24px;">&#127775;</span>
          </div>
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Il tuo digest settimanale</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">${data.weekLabel} &mdash; ciao ${data.userName}!</p>
        </td>
      </tr>

      <!-- Body -->
      <tr><td style="padding:32px 40px;">

        <!-- GPT digest paragraph -->
        <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.7;">${data.digestBody}</p>

        <!-- KPI row -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
          <tr>
            <td style="text-align:center;padding:16px 8px;background:#fafafa;border-radius:12px;">
              <div style="font-size:24px;font-weight:700;color:#111827;">${data.totalSessions}</div>
              <div style="font-size:11px;color:#9ca3af;margin-top:2px;">Sessioni</div>
            </td>
            <td width="8"></td>
            <td style="text-align:center;padding:16px 8px;background:#fafafa;border-radius:12px;">
              <div style="font-size:24px;font-weight:700;color:#111827;">${data.totalMessages}</div>
              <div style="font-size:11px;color:#9ca3af;margin-top:2px;">Messaggi</div>
            </td>
            <td width="8"></td>
            <td style="text-align:center;padding:16px 8px;background:#fafafa;border-radius:12px;">
              <div style="font-size:24px;font-weight:700;color:#6366f1;">${confPct}</div>
              <div style="font-size:11px;color:#9ca3af;margin-top:2px;">Confidence</div>
            </td>
            <td width="8"></td>
            <td style="text-align:center;padding:16px 8px;background:#fafafa;border-radius:12px;">
              <div style="font-size:24px;font-weight:700;color:#f59e0b;">${data.streakDays}&#128293;</div>
              <div style="font-size:11px;color:#9ca3af;margin-top:2px;">Streak</div>
            </td>
          </tr>
        </table>

        <!-- Topics -->
        ${data.topTopics.length > 0 ? `
        <div style="margin-bottom:24px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Temi della settimana</p>
          <div>${topicsPills}</div>
        </div>` : ""}

        <!-- Pattern highlight -->
        ${data.patternHighlight ? `
        <div style="background:#f5f3ff;border-left:3px solid #6366f1;border-radius:0 10px 10px 0;padding:14px 16px;margin-bottom:28px;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#7c3aed;">&#129504; Pattern osservato</p>
          <p style="margin:0;font-size:14px;color:#374151;line-height:1.5;">${data.patternHighlight}</p>
        </div>` : ""}

        <!-- CTA -->
        <div style="text-align:center;">
          <a href="${data.ctaUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:-0.2px;">Apri il tuo coach &#8594;</a>
        </div>

      </td></tr>

      <!-- Footer -->
      <tr>
        <td style="padding:20px 40px;background:#fafafa;text-align:center;border-top:1px solid #f0f0f0;">
          <p style="margin:0;font-size:12px;color:#d1d5db;">NorthStar &mdash; Coach AI per la crescita personale<br/>Ricevi questa email ogni luned&igrave; mattina.</p>
        </td>
      </tr>

    </table>
    <!-- /Card -->

    </td></tr>
  </table>
  <!-- /Wrapper -->

</body>
</html>
  `.trim();

  return { subject, html };
}
