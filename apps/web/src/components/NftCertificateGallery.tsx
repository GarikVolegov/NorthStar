import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";
import { CATEGORY_LABELS, CERTIFICATE_CATEGORY_COLORS } from "@/lib/constants";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Gem,
  Info,
  Shield,
  Sparkles
} from "lucide-react";
import { useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";

interface NftCert {
  id: number;
  userId: number;
  objectiveId: number;
  objectiveText: string;
  userName: string;
  category: string;
  certificateHash: string;
  metadata: Record<string, unknown>;
  mintedAt: string;
  status: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-400" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

function NftCard({ cert }: { cert: NftCert }) {
  const fallbackColors = {
    bg: "hsl(var(--muted))",
    accent: "hsl(var(--primary))",
  };
  const colors =
    CERTIFICATE_CATEGORY_COLORS[cert.category] ??
    CERTIFICATE_CATEGORY_COLORS.altro ??
    fallbackColors;
  const label = CATEGORY_LABELS[cert.category] ?? "Traguardo";
  const date = new Date(cert.mintedAt).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const shortHash =
    cert.certificateHash.slice(0, 8) + "…" + cert.certificateHash.slice(-6);
  const verifyUrl = `${window.location.origin}/certificato/${cert.certificateHash}`;
  const imageUrl = `${BASE}api/nft-certificates/image/${cert.certificateHash}.png`;

  return (
    <div
      className="rounded-2xl border overflow-hidden group transition-all duration-300 hover:scale-[1.01] hover:shadow-xl"
      style={{
        borderColor: `${colors.accent}30`,
        background: `linear-gradient(135deg, ${colors.bg}, hsl(var(--card)))`,
      }}
    >
      {/* Certificate image preview */}
      <div className="relative w-full aspect-1200/630 overflow-hidden bg-card">
        <img
          src={imageUrl}
          alt={`Certificato: ${cert.objectiveText}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-3">
          <a
            href={verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-white/80 hover:text-white flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" /> Vedi certificato
          </a>
          <a
            href={imageUrl}
            download={`northstar-cert-${cert.id}.png`}
            className="text-[11px] text-white/80 hover:text-white flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            Scarica PNG
          </a>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 space-y-3">
        {/* Category badge + date */}
        <div className="flex items-center justify-between">
          <span
            className="text-[11px] font-bold tracking-widest px-2.5 py-1 rounded-full uppercase"
            style={{
              color: colors.accent,
              background: colors.bg,
              border: `1px solid ${colors.accent}30`,
            }}
          >
            {label}
          </span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {date}
          </div>
        </div>

        {/* Objective text */}
        <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
          {cert.objectiveText}
        </p>

        {/* Hash + verify */}
        <div className="rounded-xl border border-border bg-background/60 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Shield className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-[11px] font-mono text-muted-foreground truncate">
                {shortHash}
              </span>
              <CopyButton text={cert.certificateHash} />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[11px] text-green-400 font-semibold">
                Verificato
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <a
            href={verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
          >
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-full gap-1.5 text-xs h-8 border-border"
            >
              <ExternalLink className="h-3 w-3" /> Verifica
            </Button>
          </a>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 rounded-full gap-1.5 text-xs h-8"
            onClick={() => {
              navigator
                .share?.({
                  title: "Il mio certificato NorthStar NFT",
                  text: `Ho completato: "${cert.objectiveText}" — verifica il mio certificato NFT`,
                  url: verifyUrl,
                })
                .catch(() => navigator.clipboard.writeText(verifyUrl));
            }}
          >
            <Sparkles className="h-3 w-3" /> Condividi
          </Button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  userId: number;
}

export function NftCertificateGallery({ userId }: Props) {
  useQueryClient();

  const { data: certs = [], isLoading } = useQuery<NftCert[]>({
    queryKey: ["nft-certificates"],
    queryFn: async () => {
      const r = await apiFetch(`${BASE}api/nft-certificates/me`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Gem className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-base text-foreground">
            I miei NFT
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-card h-52 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gem className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-base text-foreground">
            Certificati NFT
            {certs.length > 0 && (
              <span className="ml-2 text-xs text-primary font-bold bg-primary/10 rounded-full px-2 py-0.5">
                {certs.length}
              </span>
            )}
          </h2>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Info className="h-3 w-3" />
          <span>Emessi al completamento degli obiettivi</span>
        </div>
      </div>

      {certs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <Gem className="h-7 w-7 text-primary/60" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">
              Nessun certificato ancora
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Completa i tuoi obiettivi per ricevere certificati NFT
              verificabili su blockchain.
              <br />
              Ogni traguardo diventa un attestato unico e condivisibile.
            </p>
          </div>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-2">
            {["Unico", "Verificabile", "Condivisibile"].map((tag) => (
              <div key={tag} className="flex items-center gap-1">
                <Check className="h-3 w-3 text-primary" /> {tag}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {certs.map((cert) => (
            <NftCard key={cert.id} cert={cert} />
          ))}
        </div>
      )}
    </div>
  );
}
