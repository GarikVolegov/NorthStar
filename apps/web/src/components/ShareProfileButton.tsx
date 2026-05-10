import React, { useState } from "react";

interface ShareProfileButtonProps {
  userId: string;
  userName: string;
  isPublic: boolean;
  onMakePublic: () => Promise<void>;
}

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "";

export function ShareProfileButton({
  userId,
  userName,
  isPublic,
  onMakePublic,
}: ShareProfileButtonProps) {
  const [open, setOpen] = useState(false);
  const [making, setMaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [publicReady, setPublicReady] = useState(isPublic);

  const profileUrl = `${BASE_URL}/profile/${userId}`;
  const ogImageUrl = `${BASE_URL}/api/og/profile/${userId}`;
  const shareText = `Scopri il mio profilo di orientamento su NorthStar ✨`;

  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${profileUrl}`)}`;
  const twitterUrl  = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(profileUrl)}`;

  async function handleMakePublic() {
    setMaking(true);
    try {
      await onMakePublic();
      setPublicReady(true);
    } finally {
      setMaking(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* silent */
    }
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "linear-gradient(135deg, #F5C842 0%, #E8A800 100%)",
          color: "#0A1628",
          border: "none",
          borderRadius: "10px",
          padding: "12px 24px",
          fontSize: "15px",
          fontWeight: "700",
          cursor: "pointer",
          letterSpacing: "0.3px",
          boxShadow: "0 4px 16px rgba(245,200,66,0.35)",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget.style.transform = "translateY(-1px)"); }}
        onMouseLeave={(e) => { (e.currentTarget.style.transform = "translateY(0)"); }}
      >
        🚀 Condividi il tuo profilo
      </button>

      {/* Share panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 12px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0D1F3C",
            border: "1px solid #1E3A5F",
            borderRadius: "16px",
            padding: "24px",
            width: "360px",
            boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
            zIndex: 1000,
          }}
        >
          {/* Close */}
          <button
            onClick={() => setOpen(false)}
            style={{
              position: "absolute",
              top: "12px",
              right: "14px",
              background: "transparent",
              border: "none",
              color: "#8BA3CC",
              fontSize: "20px",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>

          <p style={{ margin: "0 0 14px", color: "#C5D8F0", fontWeight: 700, fontSize: "16px" }}>
            Condividi il tuo profilo
          </p>

          {/* Make public CTA if private */}
          {!publicReady && (
            <div
              style={{
                background: "#0A1628",
                border: "1px solid #F5C842",
                borderRadius: "10px",
                padding: "12px 14px",
                marginBottom: "16px",
              }}
            >
              <p style={{ margin: "0 0 10px", color: "#F5C842", fontSize: "13px", fontWeight: 600 }}>
                ⚠️ Il tuo profilo è privato
              </p>
              <p style={{ margin: "0 0 12px", color: "#8BA3CC", fontSize: "12px" }}>
                Per condividere la card, rendilo pubblico prima.
              </p>
              <button
                onClick={handleMakePublic}
                disabled={making}
                style={{
                  background: "linear-gradient(135deg, #F5C842 0%, #E8A800 100%)",
                  color: "#0A1628",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 18px",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: making ? "wait" : "pointer",
                  width: "100%",
                }}
              >
                {making ? "Salvataggio…" : "✅ Rendi pubblico"}
              </button>
            </div>
          )}

          {/* Live preview */}
          {publicReady && (
            <div style={{ marginBottom: "16px", borderRadius: "10px", overflow: "hidden", border: "1px solid #1E3A5F" }}>
              <img
                src={ogImageUrl}
                alt={`Profilo di ${userName}`}
                style={{ width: "100%", display: "block" }}
                loading="lazy"
              />
            </div>
          )}

          {/* Share buttons */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={shareBtn("#0A66C2")}
            >
              <LinkedInIcon /> LinkedIn
            </a>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={shareBtn("#25D366")}
            >
              <WhatsAppIcon /> WhatsApp
            </a>
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={shareBtn("#000000")}
            >
              <XIcon /> X
            </a>
          </div>

          {/* Copy link */}
          <button
            onClick={handleCopy}
            style={{
              width: "100%",
              background: copied ? "#0D2A14" : "#0A1628",
              border: `1px solid ${copied ? "#25D366" : "#1E3A5F"}`,
              borderRadius: "8px",
              padding: "10px",
              color: copied ? "#25D366" : "#8BA3CC",
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.2s",
              fontWeight: 600,
            }}
          >
            {copied ? "✅ Link copiato!" : "🔗 Copia link"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function shareBtn(bg: string): React.CSSProperties {
  return {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    background: bg,
    color: "#FFFFFF",
    border: "none",
    borderRadius: "8px",
    padding: "9px 6px",
    fontSize: "12px",
    fontWeight: 700,
    textDecoration: "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function LinkedInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.736-8.845L1.254 2.25H8.08l4.259 5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}
