import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  dbCertificateStore,
  type CertificateStore,
  type IssuedCertificate,
} from "../services/certificates/certificate-issuer";
import { sendOptionalReadFallback } from "../lib/persistence";

export function createNftCertificatesRouter({
  store = dbCertificateStore,
}: {
  store?: CertificateStore;
} = {}) {
  const router = Router();

  router.get("/me", requireAuth, async (req, res) => {
    try {
      const certificates = await store.listByUser(req.user!.id);
      res.json({ certificates: certificates.map(serializeCertificateSummary) });
    } catch (err) {
      req.log?.error?.({ err }, "nft-certificates list error");
      if (sendOptionalReadFallback(req, res, err, "nft-certificates.mine", { certificates: [] })) return;
      res.json({ certificates: [] });
    }
  });

  router.get("/verify/:hash", async (req, res) => {
    const certificate = await store.findPublicByHash(req.params.hash ?? "");
    if (!certificate) {
      res.status(404).json({ valid: false, error: "Certificato non trovato" });
      return;
    }

    res.json({ valid: true, certificate: serializePublicCertificate(certificate) });
  });

  router.get("/image/:hash.svg", async (req, res) => {
    const certificate = await store.findPublicByHash(req.params.hash ?? "");
    if (!certificate) {
      res.status(404).type("text/plain").send("Certificato non trovato");
      return;
    }

    res
      .status(200)
      .set({
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      })
      .send(renderCertificateSvg(certificate));
  });

  return router;
}

function serializeCertificateSummary(certificate: IssuedCertificate) {
  const publicCertificate = serializePublicCertificate(certificate);
  return {
    ...publicCertificate,
    userId: certificate.userId,
    objectiveId: certificate.objectiveId,
    metadata: certificate.metadata,
    isPublic: certificate.isPublic,
    verifyUrl: `/certificato/${certificate.certificateHash}`,
    imageUrl: `/api/nft-certificates/image/${certificate.certificateHash}.svg`,
  };
}

function serializePublicCertificate(certificate: IssuedCertificate) {
  return {
    id: certificate.id,
    userName: certificate.userName,
    objectiveText: certificate.objectiveText,
    category: certificate.category,
    certificateHash: certificate.certificateHash,
    chain: certificate.chain,
    chainId: certificate.chainId,
    txHash: certificate.txHash,
    mintedAt: certificate.mintedAt.toISOString(),
    completedAt: certificate.metadata.completedAt,
    status: certificate.status,
  };
}

function renderCertificateSvg(certificate: IssuedCertificate): string {
  const shortHash = `${certificate.certificateHash.slice(0, 16)}...${certificate.certificateHash.slice(-10)}`;
  const issuedAt = new Date(certificate.metadata.completedAt).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const category = categoryLabel(certificate.category);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
  <title id="title">Certificato NorthStar</title>
  <desc id="desc">Certificato verificabile per ${escapeXml(certificate.objectiveText)}</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#07111f"/>
      <stop offset="46%" stop-color="#14233a"/>
      <stop offset="100%" stop-color="#0a0d14"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8e39b"/>
      <stop offset="52%" stop-color="#d0a94d"/>
      <stop offset="100%" stop-color="#75551e"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#000000" flood-opacity="0.38"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="40" y="40" width="1120" height="550" rx="28" fill="none" stroke="#d0a94d" stroke-width="3"/>
  <rect x="70" y="70" width="1060" height="490" rx="20" fill="#ffffff" opacity="0.035" stroke="#ffffff" stroke-opacity="0.12"/>
  <g filter="url(#shadow)">
    <circle cx="600" cy="145" r="62" fill="url(#gold)"/>
    <circle cx="600" cy="145" r="45" fill="#111827" stroke="#f8e39b" stroke-width="2"/>
    <path d="M600 86 L614 131 L660 145 L614 159 L600 204 L586 159 L540 145 L586 131 Z" fill="url(#gold)"/>
  </g>
  <text x="600" y="250" text-anchor="middle" fill="#f8e39b" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="4">NORTHSTAR LEDGER</text>
  <text x="600" y="292" text-anchor="middle" fill="#ffffff" font-family="Georgia, 'Times New Roman', serif" font-size="44" font-weight="700">Attestato di completamento</text>
  <text x="600" y="334" text-anchor="middle" fill="#a7b0c4" font-family="Inter, Arial, sans-serif" font-size="18">Certificato digitale off-chain verificabile pubblicamente</text>
  <foreignObject x="170" y="365" width="860" height="86">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Inter, Arial, sans-serif; color: white; font-size: 28px; font-weight: 700; line-height: 1.25; text-align: center;">
      ${escapeXml(certificate.objectiveText)}
    </div>
  </foreignObject>
  <text x="600" y="482" text-anchor="middle" fill="#e9eefc" font-family="Inter, Arial, sans-serif" font-size="18">Rilasciato a ${escapeXml(certificate.userName)} - ${escapeXml(category)} - ${escapeXml(issuedAt)}</text>
  <text x="600" y="525" text-anchor="middle" fill="#93a0b8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="15">SHA-256 ${escapeXml(shortHash)}</text>
  <text x="600" y="554" text-anchor="middle" fill="#5eead4" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="700">STATUS: ISSUED - CHAIN: ${escapeXml(certificate.chain)}</text>
</svg>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    analisi: "Analisi",
    ricerca: "Ricerca",
    carriera: "Carriera",
    business: "Business",
    mercato: "Mercato",
    scoperta: "Scoperta",
    esplorazione: "Esplorazione",
    decisione: "Decisione",
    selezione: "Selezione",
    reclutamento: "Reclutamento",
    altro: "Traguardo",
  };
  return labels[category] ?? "Traguardo";
}

export default createNftCertificatesRouter();
