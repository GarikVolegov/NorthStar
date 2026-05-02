import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  X, Loader2, Printer, RefreshCw, Sparkles, Briefcase,
  GraduationCap, Wrench, Award, Globe, Mail, Phone,
  MapPin, Linkedin, ExternalLink, CheckCircle2, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { CvData } from "./CvSection";

const BASE = import.meta.env.BASE_URL || "/";

interface GraphNode {
  id: string; label: string;
  type: "role" | "skill" | "tool" | "certification";
  description: string; userAdded?: boolean;
}

interface GeneratedCv {
  personalInfo: {
    name: string; email?: string; phone?: string; location?: string;
    linkedin?: string; website?: string; title?: string;
  };
  summary: string;
  experience: Array<{
    id: string; title: string; company: string; period: string;
    location?: string; description: string; skills: string[];
  }>;
  education: Array<{
    id: string; degree: string; institution: string; year: string; description?: string;
  }>;
  skills: string[];
  tools: string[];
  languages: Array<{ language: string; level: string }>;
  certifications: string[];
  targetRole?: string;
  generatedAt?: string;
}

function useProfileForCv(userId: number) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetch(`${BASE}api/profile/${userId}`).then((r) => r.json()),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

// ── A4 CV Renderer ────────────────────────────────────────────────────
function CvDocument({ cv }: { cv: GeneratedCv }) {
  return (
    <div
      id="cv-document"
      className="bg-white text-gray-900 shadow-2xl mx-auto"
      style={{ width: "210mm", minHeight: "297mm", fontFamily: "system-ui, -apple-system, sans-serif" }}
    >
      {/* Header */}
      <div style={{ background: "#1a3a2a", padding: "32px 40px 28px", color: "#ffffff" }}>
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "700", letterSpacing: "-0.5px", fontFamily: "Georgia, serif" }}>
          {cv.personalInfo.name}
        </h1>
        {cv.personalInfo.title && (
          <p style={{ margin: "6px 0 0", fontSize: "14px", color: "#86efac", fontWeight: "500" }}>
            {cv.personalInfo.title}
          </p>
        )}
        {cv.targetRole && cv.targetRole !== cv.personalInfo.title && (
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>
            Target: {cv.targetRole}
          </p>
        )}

        {/* Contact row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "16px" }}>
          {cv.personalInfo.email && (
            <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
              ✉ {cv.personalInfo.email}
            </span>
          )}
          {cv.personalInfo.phone && (
            <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
              ✆ {cv.personalInfo.phone}
            </span>
          )}
          {cv.personalInfo.location && (
            <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
              ⌖ {cv.personalInfo.location}
            </span>
          )}
          {cv.personalInfo.linkedin && (
            <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#86efac" }}>
              in {cv.personalInfo.linkedin.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, "")}
            </span>
          )}
          {cv.personalInfo.website && (
            <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#86efac" }}>
              ⌘ {cv.personalInfo.website}
            </span>
          )}
        </div>
      </div>

      {/* Two-column body */}
      <div style={{ display: "flex", gap: 0 }}>

        {/* Left column */}
        <div style={{ width: "38%", background: "#f8faf9", borderRight: "1px solid #e5e7eb", padding: "28px 24px", flexShrink: 0 }}>

          {/* Skills */}
          {cv.skills.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase", color: "#1a3a2a", marginBottom: "12px", borderBottom: "2px solid #1a3a2a", paddingBottom: "6px" }}>
                Competenze
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {cv.skills.map((s) => (
                  <span key={s} style={{ fontSize: "11px", background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: "999px", padding: "3px 10px", fontWeight: "500" }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tools */}
          {cv.tools.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase", color: "#1a3a2a", marginBottom: "12px", borderBottom: "2px solid #1a3a2a", paddingBottom: "6px" }}>
                Strumenti
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {cv.tools.map((t) => (
                  <span key={t} style={{ fontSize: "11px", background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", borderRadius: "999px", padding: "3px 10px", fontWeight: "500" }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Languages */}
          {cv.languages.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase", color: "#1a3a2a", marginBottom: "12px", borderBottom: "2px solid #1a3a2a", paddingBottom: "6px" }}>
                Lingue
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {cv.languages.map((l) => (
                  <div key={l.language} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>{l.language}</span>
                    <span style={{ fontSize: "11px", color: "#6b7280", background: "#f3f4f6", borderRadius: "999px", padding: "2px 8px" }}>{l.level}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certifications */}
          {cv.certifications.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase", color: "#1a3a2a", marginBottom: "12px", borderBottom: "2px solid #1a3a2a", paddingBottom: "6px" }}>
                Certificazioni
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {cv.certifications.map((c) => (
                  <div key={c} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                    <span style={{ color: "#1a3a2a", fontSize: "14px", lineHeight: "18px", flexShrink: 0 }}>✦</span>
                    <span style={{ fontSize: "12px", color: "#374151", lineHeight: "1.5" }}>{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NorthStar credit */}
          <div style={{ marginTop: "32px", padding: "12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px" }}>
            <p style={{ margin: 0, fontSize: "10px", color: "#15803d", textAlign: "center", fontWeight: "500" }}>
              ✦ Generato con NorthStar
            </p>
          </div>
        </div>

        {/* Right column */}
        <div style={{ flex: 1, padding: "28px 32px" }}>

          {/* Summary */}
          {cv.summary && (
            <div style={{ marginBottom: "28px" }}>
              <h3 style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase", color: "#1a3a2a", marginBottom: "10px", borderBottom: "2px solid #1a3a2a", paddingBottom: "6px" }}>
                Profilo Professionale
              </h3>
              <p style={{ fontSize: "13px", color: "#4b5563", lineHeight: "1.7", margin: 0 }}>
                {cv.summary}
              </p>
            </div>
          )}

          {/* Experience */}
          {cv.experience.length > 0 && (
            <div style={{ marginBottom: "28px" }}>
              <h3 style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase", color: "#1a3a2a", marginBottom: "14px", borderBottom: "2px solid #1a3a2a", paddingBottom: "6px" }}>
                Esperienza Professionale
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                {cv.experience.map((e) => (
                  <div key={e.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                      <div>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>{e.title}</p>
                        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6b7280" }}>
                          {e.company}{e.location ? ` · ${e.location}` : ""}
                        </p>
                      </div>
                      <span style={{ fontSize: "11px", color: "#9ca3af", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "999px", padding: "2px 10px", flexShrink: 0 }}>
                        {e.period}
                      </span>
                    </div>
                    {e.description && (
                      <div style={{ fontSize: "12px", color: "#4b5563", lineHeight: "1.7", marginTop: "6px" }}>
                        {e.description.split("\n").map((line, i) => (
                          <p key={i} style={{ margin: "3px 0" }}>
                            {line.startsWith("→") ? <span style={{ color: "#1a3a2a", marginRight: "4px" }}>→</span> : null}
                            {line.startsWith("→") ? line.slice(1).trim() : line}
                          </p>
                        ))}
                      </div>
                    )}
                    {e.skills.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>
                        {e.skills.map((s) => (
                          <span key={s} style={{ fontSize: "10px", background: "#f3f4f6", color: "#6b7280", borderRadius: "999px", padding: "2px 8px" }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {cv.education.length > 0 && (
            <div>
              <h3 style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase", color: "#1a3a2a", marginBottom: "14px", borderBottom: "2px solid #1a3a2a", paddingBottom: "6px" }}>
                Formazione
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {cv.education.map((e) => (
                  <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#111827" }}>{e.degree}</p>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6b7280" }}>{e.institution}</p>
                      {e.description && (
                        <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#9ca3af" }}>{e.description}</p>
                      )}
                    </div>
                    <span style={{ fontSize: "11px", color: "#9ca3af", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "999px", padding: "2px 10px", flexShrink: 0 }}>
                      {e.year}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────
export function CvGeneratorModal({
  userId, cvData, confirmedSectorId, onClose,
}: {
  userId: number;
  cvData: CvData | null;
  confirmedSectorId?: number;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { data: profile } = useProfileForCv(userId);
  const [generated, setGenerated] = useState<GeneratedCv | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Read graph nodes from localStorage
  function readGraphNodes(): GraphNode[] {
    try {
      const key = `grafo_user_${confirmedSectorId}_${userId}`;
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      return JSON.parse(raw).nodes ?? [];
    } catch { return []; }
  }

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const latestSession = profile?.testSessions?.[0];
      const confirmedSector = profile?.exploredSectors?.find((s: any) => s.confirmed);

      const graphNodes = readGraphNodes();

      const res = await fetch(`${BASE}api/cv/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          profileData: {
            name: user?.name ?? profile?.name ?? "",
            email: user?.email ?? profile?.email ?? "",
            riasecTypes: latestSession?.primaryTypes ?? [],
            confirmedSector: confirmedSector?.name ?? "",
            skills: confirmedSector?.skills ?? [],
          },
          graphNodes,
          cvData: cvData ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore nella generazione");
      setGenerated(data.generated);
    } catch (err: any) {
      setError(err.message || "Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-generate on open
  useEffect(() => {
    generate();
  }, []);

  // Print styles
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "cv-print-style";
    style.textContent = `
      @media print {
        body > *:not(#cv-print-portal) { display: none !important; }
        #cv-print-portal { position: fixed; top: 0; left: 0; width: 100%; z-index: 99999; }
        #cv-document { box-shadow: none !important; margin: 0 !important; width: 100% !important; }
        @page { margin: 0; size: A4; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById("cv-print-style")?.remove(); };
  }, []);

  function handlePrint() {
    window.print();
  }

  return (
    <div
      id="cv-print-portal"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 bg-background/95 border-b shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">CV Generato con NorthStar</p>
            {generated?.targetRole && (
              <p className="text-xs text-muted-foreground">Target: {generated.targetRole}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {generated && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full gap-1.5"
                onClick={generate}
                disabled={loading}
              >
                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                Rigenera
              </Button>
              <Button
                size="sm"
                className="rounded-full gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handlePrint}
              >
                <Printer className="w-3.5 h-3.5" />
                Stampa / Scarica PDF
              </Button>
            </>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors ml-1"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto py-8 px-4 print:p-0" ref={containerRef}>
        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Generazione CV in corso…</p>
              <p className="text-sm text-muted-foreground mt-1">
                Sto integrando il grafo delle conoscenze{cvData ? " e il tuo CV" : ""} con il profilo RIASEC
              </p>
            </div>
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {error && !loading && (
          <div className="max-w-md mx-auto mt-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-destructive" />
            </div>
            <p className="font-semibold text-foreground mb-2">Errore nella generazione</p>
            <p className="text-sm text-muted-foreground mb-5">{error}</p>
            <Button onClick={generate} className="rounded-full">Riprova</Button>
          </div>
        )}

        {generated && !loading && (
          <CvDocument cv={generated} />
        )}
      </div>

      {/* Footer hint */}
      {generated && !loading && (
        <div className="text-center py-2.5 text-xs text-white/70 bg-black/30 print:hidden">
          Clicca "Stampa / Scarica PDF" per salvare il CV · Il browser aprirà la finestra di stampa
        </div>
      )}
    </div>
  );
}
