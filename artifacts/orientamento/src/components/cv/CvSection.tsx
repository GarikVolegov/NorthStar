import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText, Upload, Loader2, Trash2, Sparkles, Network,
  Briefcase, GraduationCap, Wrench, Award, Globe, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Plus, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CvGeneratorModal } from "./CvGeneratorModal";
import { useAuth } from "@/contexts/AuthContext";

const BASE = import.meta.env.BASE_URL || "/";

export interface CvData {
  personalInfo: {
    name: string; email?: string; phone?: string;
    location?: string; linkedin?: string; website?: string; title?: string;
  };
  summary?: string;
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
  extractedAt?: string;
  generated?: any;
  lastGenerated?: string;
  lastSaved?: string;
}

interface GraphNode {
  id: string; label: string;
  type: "role" | "skill" | "tool" | "certification";
  description: string; userAdded?: boolean;
}

function useCv(userId: number) {
  return useQuery<{ cvData: CvData | null; hasCv: boolean }>({
    queryKey: ["cv", userId],
    queryFn: () => fetch(`${BASE}api/cv/${userId}`).then((r) => r.json()),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

// ── Extracted chips ───────────────────────────────────────────────────
function ChipList({ items, color = "primary" }: { items: string[]; color?: string }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 8);
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((item) => (
        <span
          key={item}
          className={cn(
            "text-xs px-2.5 py-0.5 rounded-full border font-medium",
            color === "primary"
              ? "bg-primary/8 text-primary border-primary/20"
              : color === "amber"
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : color === "violet"
              ? "bg-violet-50 text-violet-700 border-violet-200"
              : "bg-muted text-muted-foreground border-border"
          )}
        >
          {item}
        </span>
      ))}
      {items.length > 8 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-primary hover:underline flex items-center gap-0.5"
        >
          {expanded ? <><ChevronUp className="w-3 h-3" />meno</> : <><ChevronDown className="w-3 h-3" />+{items.length - 8} altri</>}
        </button>
      )}
    </div>
  );
}

// ── Graph node suggestions from CV ────────────────────────────────────
function GraphSuggestions({
  cvData, sectorId, userId,
  onAdded,
}: {
  cvData: CvData; sectorId?: number; userId: number; onAdded?: () => void;
}) {
  const storageKey = `grafo_user_${sectorId}_${userId}`;
  const existing = (() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : { nodes: [], edges: [] };
    } catch { return { nodes: [], edges: [] }; }
  })();

  const existingLabels = new Set<string>(
    (existing.nodes as GraphNode[]).map((n) => n.label.toLowerCase())
  );

  const suggestions: GraphNode[] = [
    ...cvData.skills.slice(0, 6).map((s, i) => ({
      id: `cv-skill-${i}`, label: s, type: "skill" as const, description: `Competenza da CV`, userAdded: true,
    })),
    ...cvData.tools.slice(0, 4).map((t, i) => ({
      id: `cv-tool-${i}`, label: t, type: "tool" as const, description: `Strumento da CV`, userAdded: true,
    })),
    ...cvData.certifications.slice(0, 3).map((c, i) => ({
      id: `cv-cert-${i}`, label: c, type: "certification" as const, description: `Certificazione da CV`, userAdded: true,
    })),
  ].filter((n) => !existingLabels.has(n.label.toLowerCase()));

  const [added, setAdded] = useState<Set<string>>(new Set());

  if (!sectorId || suggestions.length === 0) return null;

  function addNode(node: GraphNode) {
    const updated = {
      nodes: [...existing.nodes, { ...node, id: `cv-${Date.now()}-${node.type}` }],
      edges: existing.edges,
    };
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setAdded((prev) => new Set(prev).add(node.label));
    onAdded?.();
  }

  const TYPE_COLORS: Record<string, string> = {
    skill: "text-emerald-700 bg-emerald-50 border-emerald-200",
    tool: "text-amber-700 bg-amber-50 border-amber-200",
    certification: "text-violet-700 bg-violet-50 border-violet-200",
  };

  const TYPE_ICONS: Record<string, React.ReactNode> = {
    skill: <Sparkles className="w-3 h-3" />,
    tool: <Wrench className="w-3 h-3" />,
    certification: <Award className="w-3 h-3" />,
  };

  return (
    <div className="mt-5 p-4 rounded-2xl border border-dashed border-primary/30 bg-primary/3">
      <div className="flex items-center gap-2 mb-3">
        <Network className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Aggiungi al Grafo delle Conoscenze</span>
        <span className="text-xs text-muted-foreground">({suggestions.length} nodi suggeriti dal tuo CV)</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((node) => (
          <button
            key={node.label}
            onClick={() => addNode(node)}
            disabled={added.has(node.label)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
              added.has(node.label)
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default"
                : cn("hover:scale-105 hover:shadow-sm cursor-pointer", TYPE_COLORS[node.type])
            )}
          >
            {added.has(node.label)
              ? <CheckCircle2 className="w-3 h-3" />
              : TYPE_ICONS[node.type]}
            {node.label}
            {!added.has(node.label) && <Plus className="w-3 h-3 ml-0.5 opacity-60" />}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2.5">
        Clicca per aggiungere i nodi al grafo del settore.{" "}
        {sectorId && (
          <a href={`${BASE}grafo/${sectorId}`} className="text-primary hover:underline">
            Apri il grafo →
          </a>
        )}
      </p>
    </div>
  );
}

// ── Main CvSection component ──────────────────────────────────────────
export function CvSection({
  userId, confirmedSectorId,
}: {
  userId: number;
  confirmedSectorId?: number;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useCv(userId);
  const cvData = data?.cvData ?? null;

  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [pasteText, setPasteText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showFullExp, setShowFullExp] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (payload: { file?: File; text?: string }) => {
      const formData = new FormData();
      formData.append("userId", String(userId));
      if (payload.file) {
        formData.append("file", payload.file);
      } else if (payload.text) {
        formData.append("rawText", payload.text);
      }
      const res = await fetch(`${BASE}api/cv/upload`, { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore durante il caricamento");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cv", userId] });
      setUploadError(null);
      setPasteText("");
    },
    onError: (err: Error) => {
      setUploadError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => fetch(`${BASE}api/cv/${userId}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cv", userId] }),
  });

  const handleFile = useCallback((file: File) => {
    if (!["application/pdf", "text/plain"].includes(file.type)) {
      setUploadError("Formato non supportato. Usa PDF o TXT.");
      return;
    }
    setUploadError(null);
    uploadMutation.mutate({ file });
  }, [uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const uploading = uploadMutation.isPending;

  // ── Render CV data ──────────────────────────────────────────────────
  if (cvData) {
    const exp = showFullExp ? cvData.experience : cvData.experience.slice(0, 2);
    return (
      <>
        <Card className="rounded-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Il mio Curriculum
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Caricato {cvData.extractedAt
                    ? new Date(cvData.extractedAt).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })
                    : "recentemente"}.
                  Usalo per generare il tuo CV ottimizzato con il grafo.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="rounded-full gap-1.5"
                  onClick={() => setShowGenerator(true)}
                >
                  <Sparkles className="w-3.5 h-3.5" /> Genera CV
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full gap-1.5 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Personal info */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/40 border">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-base font-serif font-bold text-primary">
                  {(cvData.personalInfo?.name || user?.name || "?").charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">
                  {cvData.personalInfo?.name || user?.name}
                </p>
                {cvData.personalInfo?.title && (
                  <p className="text-sm text-primary font-medium">{cvData.personalInfo.title}</p>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  {cvData.personalInfo?.location && (
                    <span className="text-xs text-muted-foreground">{cvData.personalInfo.location}</span>
                  )}
                  {cvData.personalInfo?.phone && (
                    <span className="text-xs text-muted-foreground">{cvData.personalInfo.phone}</span>
                  )}
                  {cvData.personalInfo?.linkedin && (
                    <a href={cvData.personalInfo.linkedin} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline">LinkedIn</a>
                  )}
                </div>
              </div>
            </div>

            {/* Skills */}
            {cvData.skills.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" /> Competenze rilevate ({cvData.skills.length})
                </p>
                <ChipList items={cvData.skills} color="primary" />
              </div>
            )}

            {/* Tools */}
            {cvData.tools.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
                  <Wrench className="w-3 h-3" /> Strumenti ({cvData.tools.length})
                </p>
                <ChipList items={cvData.tools} color="amber" />
              </div>
            )}

            {/* Experience */}
            {cvData.experience.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
                  <Briefcase className="w-3 h-3" /> Esperienza ({cvData.experience.length})
                </p>
                <div className="space-y-3">
                  {exp.map((e) => (
                    <div key={e.id} className="border rounded-xl p-3.5 bg-card">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm text-foreground">{e.title}</p>
                          <p className="text-xs text-muted-foreground">{e.company} · {e.period}</p>
                        </div>
                        {e.location && <span className="text-xs text-muted-foreground shrink-0">{e.location}</span>}
                      </div>
                      {e.description && (
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-3">{e.description}</p>
                      )}
                      {e.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {e.skills.slice(0, 4).map((s) => (
                            <span key={s} className="text-[10px] bg-muted rounded-full px-2 py-0.5 text-muted-foreground">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {cvData.experience.length > 2 && (
                    <button
                      onClick={() => setShowFullExp((v) => !v)}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      {showFullExp
                        ? <><ChevronUp className="w-3 h-3" />Meno esperienze</>
                        : <><ChevronDown className="w-3 h-3" />+{cvData.experience.length - 2} esperienze</>}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Education */}
            {cvData.education.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
                  <GraduationCap className="w-3 h-3" /> Formazione
                </p>
                <div className="space-y-2">
                  {cvData.education.map((e) => (
                    <div key={e.id} className="flex items-start gap-3 border rounded-xl p-3.5 bg-card">
                      <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                        <GraduationCap className="w-4 h-4 text-violet-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-foreground">{e.degree}</p>
                        <p className="text-xs text-muted-foreground">{e.institution} · {e.year}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications + Languages */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {cvData.certifications.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
                    <Award className="w-3 h-3" /> Certificazioni
                  </p>
                  <ChipList items={cvData.certifications} color="violet" />
                </div>
              )}
              {cvData.languages.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
                    <Globe className="w-3 h-3" /> Lingue
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {cvData.languages.map((l) => (
                      <span key={l.language} className="text-xs px-2.5 py-0.5 rounded-full border bg-muted text-muted-foreground">
                        {l.language} <span className="opacity-60">· {l.level}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Graph suggestions */}
            <GraphSuggestions
              cvData={cvData}
              sectorId={confirmedSectorId}
              userId={userId}
            />
          </CardContent>
        </Card>

        {showGenerator && (
          <CvGeneratorModal
            userId={userId}
            cvData={cvData}
            confirmedSectorId={confirmedSectorId}
            onClose={() => setShowGenerator(false)}
          />
        )}
      </>
    );
  }

  // ── Upload zone ─────────────────────────────────────────────────────
  return (
    <>
      <Card className="rounded-2xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Il mio Curriculum
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Carica il tuo CV per integrarlo con il Grafo delle Conoscenze e generare una versione ottimizzata.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full gap-1.5"
              onClick={() => setShowGenerator(true)}
            >
              <Sparkles className="w-3.5 h-3.5" /> Genera senza CV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Mode switcher */}
          <div className="flex rounded-xl bg-muted p-1 w-fit">
            <button
              onClick={() => setMode("upload")}
              className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-all", mode === "upload" ? "bg-white shadow text-foreground" : "text-muted-foreground")}
            >
              Carica file
            </button>
            <button
              onClick={() => setMode("paste")}
              className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-all", mode === "paste" ? "bg-white shadow text-foreground" : "text-muted-foreground")}
            >
              Incolla testo
            </button>
          </div>

          {mode === "upload" ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileRef.current?.click()}
              className={cn(
                "relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer",
                dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-muted/30",
                uploading && "cursor-wait opacity-70"
              )}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-sm font-medium text-foreground">Analisi in corso con AI…</p>
                  <p className="text-xs text-muted-foreground">Sto estraendo competenze, esperienze e formazione</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Upload className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Trascina il CV qui o clicca per selezionarlo</p>
                    <p className="text-sm text-muted-foreground mt-1">PDF o TXT · Max 10 MB</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Incolla qui il testo del tuo CV…"
                className="min-h-[180px] rounded-xl text-sm resize-none"
              />
              <Button
                className="rounded-full gap-1.5"
                disabled={pasteText.trim().length < 50 || uploading}
                onClick={() => uploadMutation.mutate({ text: pasteText })}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Analizza con AI
              </Button>
            </div>
          )}

          {/* Error */}
          {uploadError && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {uploadError}
            </div>
          )}

          {/* Features teaser */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {[
              { icon: <Network className="w-4 h-4 text-primary" />, title: "Integrazione Grafo", desc: "Suggerisce nodi skill/tool da aggiungere al grafo del tuo settore" },
              { icon: <Sparkles className="w-4 h-4 text-primary" />, title: "CV Ottimizzato", desc: "Genera un CV professionale basato sul grafo e il profilo RIASEC" },
              { icon: <FileText className="w-4 h-4 text-primary" />, title: "Stampa & Scarica", desc: "Esporta il CV generato in PDF con un click dal browser" },
            ].map((f) => (
              <div key={f.title} className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  {f.icon}
                  <span className="text-xs font-semibold text-foreground">{f.title}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

        </CardContent>
      </Card>

      {showGenerator && (
        <CvGeneratorModal
          userId={userId}
          cvData={null}
          confirmedSectorId={confirmedSectorId}
          onClose={() => setShowGenerator(false)}
        />
      )}
    </>
  );
}
