/**
 * CvSection — Upload CV + Genera da profilo con scelta template + Modifica + Download multi-formato
 *
 * Endpoints:
 *   GET    /api/cv/mine                     → { cvs: CvMeta[] }
 *   POST   /api/cv/mine/upload              → multipart, { success, cvs }
 *   POST   /api/cv/mine/generate            → body { template }, { success, cvs }
 *   PATCH  /api/cv/mine/generated           → body { generated }, { success }
 *   DELETE /api/cv/mine                     → { success }
 *   GET    /api/cv/:userId/pdf?template=    → binary PDF
 *   GET    /api/cv/:userId/docx             → binary DOCX
 */
import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText, Upload, Sparkles, Trash2,
  Loader2, CheckCircle2, AlertCircle, LayoutTemplate, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";
import { CvEditorDrawer } from "./cv/CvEditorDrawer";
import { CvDownloadMenu } from "./cv/CvDownloadMenu";

const BASE = import.meta.env.BASE_URL || "/";

type CvTemplate = "classic" | "minimal" | "bold";

const TEMPLATES: Array<{
  id: CvTemplate; label: string; desc: string;
  accent: string; bg: string; border: string; dot1: string; dot2: string;
}> = [
  { id: "classic", label: "Classic", desc: "Verde scuro · 2 colonne", accent: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-300", dot1: "bg-growth/20", dot2: "bg-growth/30" },
  { id: "minimal", label: "Minimal", desc: "Bianco · 1 colonna",    accent: "text-gray-700",    bg: "bg-gray-50",    border: "border-gray-300",    dot1: "bg-gray-800",    dot2: "bg-gray-400" },
  { id: "bold",    label: "Bold",    desc: "Navy · Arancio",       accent: "text-orange-600",  bg: "bg-orange-50",  border: "border-orange-300",  dot1: "bg-card",  dot2: "bg-chart-1" },
];

const LS_KEY = "ns_cv_template";

interface CvMeta {
  id: string; filename: string; uploadedAt: string;
  source: "upload" | "generated"; hasPdf: boolean; template?: CvTemplate;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

export function CvSection({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [generatedCvData, setGeneratedCvData] = useState<any>(null);

  const [selectedTemplate, setSelectedTemplate] = useState<CvTemplate>(() => {
    try { return (localStorage.getItem(LS_KEY) as CvTemplate) ?? "classic"; } catch { return "classic"; }
  });
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, selectedTemplate); } catch {}
  }, [selectedTemplate]);

  // ── Fetch CVs
  const { data, isLoading } = useQuery<{ cvs: CvMeta[] }>({
    queryKey: ["cvs-mine", userId],
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/cv/mine`);
      if (!res.ok) throw new Error("Errore caricamento CV");
      return res.json();
    },
    enabled: !!userId,
    staleTime: 30_000,
    retry: false,
  });

  const cvs = data?.cvs ?? [];
  const generatedCv = cvs.find((c) => c.source === "generated") ?? null;
  const uploadedCv  = cvs.find((c) => c.source === "upload") ?? null;

  useEffect(() => {
    if (generatedCv?.template) setSelectedTemplate(generatedCv.template);
  }, [generatedCv?.template]);

  // Fetch generated CV data when opening editor
  async function openEditor() {
    if (!generatedCv) return;
    try {
      const res = await apiFetch(`${BASE}api/cv/${userId}`);
      if (!res.ok) return;
      const j = await res.json();
      const gen = j.cvData?.generated ?? null;
      if (gen) { setGeneratedCvData(gen); setEditorOpen(true); }
    } catch {}
  }

  // ── Upload (base64 JSON, senza multer)
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await apiFetch(`${BASE}api/cv/mine/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileDataUrl: dataUrl, filename: file.name, mimeType: file.type }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? "Errore upload"); }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cvs-mine", userId] }); setUploadError(null); },
    onError: (err: Error) => setUploadError(err.message),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) { setUploadError("File troppo grande (max 5 MB)"); return; }
    if (!["application/pdf", "text/plain"].includes(file.type)) { setUploadError("Solo PDF o TXT"); return; }
    setUploadError(null);
    uploadMutation.mutate(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Generate
  const generateMutation = useMutation({
    mutationFn: async (template: CvTemplate) => {
      const res = await apiFetch(`${BASE}api/cv/mine/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? "Errore generazione"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cvs-mine", userId] });
      setGenerateError(null);
      setShowTemplatePicker(false);
    },
    onError: (err: Error) => setGenerateError(err.message),
  });

  // ── Delete
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${BASE}api/cv/mine`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore eliminazione");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cvs-mine", userId] }); },
  });

  const isBusy = uploadMutation.isPending || generateMutation.isPending || deleteMutation.isPending;
  const activeTpl = TEMPLATES.find((t) => t.id === selectedTemplate) ?? TEMPLATES[0];

  return (
    <>
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Il mio CV
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Caricamento...
            </div>
          )}

          {/* CV generato */}
          {!isLoading && generatedCv && (
            <div className="flex items-start justify-between gap-3 p-3 rounded-xl border bg-primary/5 border-primary/20">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{generatedCv.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    Generato · {formatDate(generatedCv.uploadedAt)}
                    {generatedCv.template && (
                      <span className={cn("ml-1.5 capitalize font-medium", activeTpl.accent)}>
                        · {TEMPLATES.find((t) => t.id === generatedCv.template)?.label ?? generatedCv.template}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {/* Edit */}
                <button
                  onClick={openEditor}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  title="Modifica CV"
                >
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                {/* Download multi-formato */}
                <CvDownloadMenu
                  userId={userId}
                  template={generatedCv.template ?? selectedTemplate}
                  filename={generatedCv.filename}
                  generatedCv={generatedCvData}
                  iconOnly
                />
                {/* Delete */}
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={isBusy}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-40"
                  title="Elimina tutto"
                >
                  {deleteMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    : <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />}
                </button>
              </div>
            </div>
          )}

          {/* CV caricato */}
          {!isLoading && uploadedCv && (
            <div className={cn(
              "flex items-start justify-between gap-3 p-3 rounded-xl border",
              generatedCv ? "bg-muted/20" : "bg-emerald-50/50 border-emerald-200",
            )}>
              <div className="flex items-start gap-2.5 min-w-0">
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                  generatedCv ? "bg-muted" : "bg-emerald-50",
                )}>
                  <FileText className={cn("w-4 h-4", generatedCv ? "text-muted-foreground" : "text-emerald-600")} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{uploadedCv.filename}</p>
                  <p className="text-xs text-muted-foreground">Caricato · {formatDate(uploadedCv.uploadedAt)}</p>
                </div>
              </div>
              {!generatedCv && (
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={isBusy}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-40 shrink-0"
                >
                  {deleteMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />}
                </button>
              )}
            </div>
          )}

          {/* Template picker */}
          {showTemplatePicker && (
            <div className="rounded-xl border bg-muted/30 p-3 space-y-2.5">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <LayoutTemplate className="w-3.5 h-3.5" /> Scegli il template
              </p>
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedTemplate(tpl.id)}
                    className={cn(
                      "relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all text-center",
                      selectedTemplate === tpl.id
                        ? `${tpl.bg} ${tpl.border} shadow-sm`
                        : "bg-background border-border hover:border-muted-foreground/40",
                    )}
                  >
                    <div className="w-10 h-14 rounded-md border border-border overflow-hidden flex flex-col">
                      <div className={cn("h-5 w-full", tpl.dot1)} />
                      <div className="flex-1 flex flex-col gap-0.5 p-1">
                        <div className={cn("h-0.5 w-full rounded-full", tpl.dot2)} />
                        <div className="h-0.5 w-3/4 rounded-full bg-muted-foreground/20" />
                        <div className="h-0.5 w-full rounded-full bg-muted-foreground/20" />
                        <div className="h-0.5 w-2/3 rounded-full bg-muted-foreground/20" />
                      </div>
                    </div>
                    <span className={cn("text-[11px] font-semibold leading-tight", selectedTemplate === tpl.id ? tpl.accent : "text-muted-foreground")}>
                      {tpl.label}
                    </span>
                    <span className="text-[9px] text-muted-foreground leading-tight">{tpl.desc}</span>
                    {selectedTemplate === tpl.id && (
                      <span className={cn("absolute top-1.5 right-1.5 w-2 h-2 rounded-full", tpl.dot2)} />
                    )}
                  </button>
                ))}
              </div>
              <Button
                size="sm" className="w-full rounded-full gap-2 text-xs" disabled={isBusy}
                onClick={() => generateMutation.mutate(selectedTemplate)}
              >
                {generateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Genera con template {activeTpl.label}
              </Button>
            </div>
          )}

          {/* Feedback */}
          {uploadMutation.isSuccess && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> CV caricato e analizzato!
            </p>
          )}
          {generateMutation.isSuccess && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> CV generato con template {activeTpl.label}!
            </p>
          )}
          {uploadError && (
            <p className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5" /> {uploadError}
            </p>
          )}
          {generateError && (
            <p className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5" /> {generateError}
            </p>
          )}

          {!isLoading && cvs.length === 0 && !isBusy && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-xl p-3 leading-relaxed">
              Nessun CV presente. Carica il tuo CV (PDF/TXT) oppure generane uno dal profilo NorthStar.
            </p>
          )}

          {/* Azioni principali */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline" size="sm" className="rounded-full gap-2 text-xs flex-1"
              disabled={isBusy} onClick={() => fileRef.current?.click()}
            >
              {uploadMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploadedCv ? "Sostituisci CV" : "Carica CV"}
            </Button>
            <Button
              size="sm" className="rounded-full gap-2 text-xs flex-1"
              disabled={isBusy} onClick={() => setShowTemplatePicker((v) => !v)}
            >
              <LayoutTemplate className="w-3.5 h-3.5" />
              {generatedCv ? "Rigenera CV" : "Genera da profilo"}
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground -mt-1">
            PDF o TXT · max 5 MB · 3 template · Scarica in PDF, DOCX o JSON
          </p>

          <input
            ref={fileRef} type="file" accept=".pdf,.txt,application/pdf,text/plain"
            className="sr-only" onChange={handleFileChange} aria-label="Carica CV"
          />
        </CardContent>
      </Card>

      {/* Editor drawer */}
      {generatedCvData && (
        <CvEditorDrawer
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          userId={userId}
          initialCv={generatedCvData}
        />
      )}
    </>
  );
}
