/**
 * Public NFT Certificate Verification Page — /certificato/:hash
 * Anyone can verify a NorthStar achievement certificate using its hash.
 */
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, CERTIFICATE_CATEGORY_COLORS } from "@/lib/constants";
import { apiFetch } from "@/lib/api-fetch";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Gem,
  Shield,
  Sparkles,
  User,
} from "lucide-react";
import { useState } from "react";
import { Link, useRoute } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

interface VerifyResult {
  valid: boolean;
  certificate: {
    id: number;
    userName: string;
    objectiveText: string;
    category: string;
    certificateHash: string;
    chain: string;
    mintedAt: string;
    status: string;
  };
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border hover:border-border/80"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? "Copiato!" : label}
    </button>
  );
}

export default function CertificatePage() {
  const [, params] = useRoute("/certificato/:hash");
  const hash = params?.hash ?? "";

  const imageUrl = `${BASE}api/nft-certificates/image/${hash}.png`;

  const { data, isLoading, isError } = useQuery<VerifyResult>({
    queryKey: ["verify-cert", hash],
    queryFn: async () => {
      const r = await apiFetch(`${BASE}api/nft-certificates/verify/${hash}`);
      if (!r.ok) throw new Error("not found");
      return r.json();
    },
    enabled: !!hash,
    retry: false,
    staleTime: Infinity,
  });

  const cert = data?.certificate;
  const colors = cert
    ? (CERTIFICATE_CATEGORY_COLORS[cert.category] ??
      CERTIFICATE_CATEGORY_COLORS.altro)
    : CERTIFICATE_CATEGORY_COLORS.altro;
  const label = cert ? (CATEGORY_LABELS[cert.category] ?? "Traguardo") : "";

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar minimal */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur border-b border-border/50 px-6 py-3 flex items-center justify-between">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <span className="text-primary text-xl">★</span>
            <span className="font-bold text-foreground">NorthStar</span>
          </div>
        </Link>
        <Link href="/">
          <Button variant="ghost" size="sm" className="rounded-full text-xs">
            ← Home
          </Button>
        </Link>
      </nav>

      <div className="pt-20 pb-16 px-4 max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border rounded-full px-4 py-2 mb-6">
            <Shield className="h-3.5 w-3.5 text-primary" />
            Verifica Certificato
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
            Attestato di completamento
          </h1>
          <p className="text-muted-foreground text-sm">
            Ogni certificato NorthStar è firmato crittograficamente e
            verificabile pubblicamente
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
            <p className="text-muted-foreground">Verifica in corso…</p>
          </div>
        )}

        {/* Not found */}
        {isError && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-10 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <div>
              <h2 className="font-bold text-foreground text-lg">
                Certificato non trovato
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                L'hash fornito non corrisponde a nessun certificato emesso da
                NorthStar.
              </p>
            </div>
            <Link href="/">
              <Button className="rounded-full">Torna alla home</Button>
            </Link>
          </div>
        )}

        {/* Valid certificate */}
        {cert && (
          <div className="space-y-6">
            {/* Verified banner */}
            <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="font-bold text-green-400 text-sm">
                  Certificato autentico e verificato
                </p>
                <p className="text-xs text-muted-foreground">
                  Hash SHA-256 corrispondente · Emesso da NorthStar ·{" "}
                  {cert.chain}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400 font-semibold">
                  {cert.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Certificate image */}
            <div className="rounded-2xl overflow-hidden border border-border shadow-xl">
              <img src={imageUrl} alt="Certificato" className="w-full" />
            </div>

            {/* Certificate details */}
            <div
              className="rounded-2xl border p-6 space-y-5"
              style={{
                borderColor: `${colors!.accent}25`,
                background: colors!.bg,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gem className="h-5 w-5" style={{ color: colors!.accent }} />
                  <h2 className="font-bold text-foreground text-lg">
                    Dettagli certificato
                  </h2>
                </div>
                <span
                  className="text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full"
                  style={{
                    color: colors!.accent,
                    background: `${colors!.accent}15`,
                    border: `1px solid ${colors!.accent}30`,
                  }}
                >
                  {label}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: User, label: "Titolare", value: cert.userName },
                  {
                    icon: Clock,
                    label: "Data certificazione",
                    value: new Date(cert.mintedAt).toLocaleDateString("it-IT", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    }),
                  },
                  { icon: Gem, label: "Chain", value: cert.chain },
                  { icon: CheckCircle2, label: "Status", value: cert.status },
                ].map(({ icon: Icon, label: lbl, value }) => (
                  <div
                    key={lbl}
                    className="rounded-xl border border-border/60 bg-background/60 p-3.5"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">
                        {lbl}
                      </span>
                    </div>
                    <p className="font-semibold text-foreground text-sm">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Objective */}
              <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> Obiettivo completato
                </div>
                <p className="font-semibold text-foreground leading-snug">
                  "{cert.objectiveText}"
                </p>
              </div>

              {/* Hash */}
              <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Shield className="h-3 w-3" /> Certificate Hash (SHA-256)
                </div>
                <p className="font-mono text-xs text-muted-foreground break-all leading-relaxed">
                  {cert.certificateHash}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-1">
                <CopyButton text={cert.certificateHash} label="Copia hash" />
                <CopyButton
                  text={window.location.href}
                  label="Copia link verifica"
                />
                <a href={imageUrl} download={`northstar-cert-${cert.id}.png`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg gap-1.5 text-sm h-9"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Scarica PNG
                  </Button>
                </a>
              </div>
            </div>

            {/* Footer note */}
            <p className="text-center text-xs text-muted-foreground">
              Questo certificato è stato emesso da{" "}
              <Link href="/">
                <span className="text-primary cursor-pointer hover:underline">
                  NorthStar
                </span>
              </Link>{" "}
              · Piattaforma di orientamento professionale italiana ·{" "}
              <span className="font-mono">
                {cert.certificateHash.slice(0, 12)}…
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
