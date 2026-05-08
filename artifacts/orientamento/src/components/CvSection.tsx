/**
 * CvSection — Upload CV + Genera da profilo
 *
 * Endpoints usati (tutti session-aware, nessun :userId nell'URL):
 *   GET    /api/cv/mine           → { cvs: CvMeta[] }
 *   POST   /api/cv/mine/upload    → { success, cvs }   (multipart form-data)
 *   POST   /api/cv/mine/generate  → { success, cvs }   (body vuoto)
 *   DELETE /api/cv/mine           → { success }
 *
 * Download PDF disponibile solo per CV generati via GET /api/cv/:userId/pdf
 */

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText, Upload, Sparkles, Trash2, Download,
  Loader2, CheckCircle2, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";

const BASE = import.meta.env.BASE_URL || "/";

interface CvMeta {
  id: string;           // "generated-{userId}" | "uploaded-{userId}"
  filename: string;
  uploadedAt: string;
  source: "upload" | "generated";
  hasPdf: boolean;      // true solo per i CV generati (PDF disponibile)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function CvSection({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // ── Fetch CVs ──────────────────────────────────────────────────────
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
  // Ordine: prima "generated", poi "uploaded"
  const generatedCv = cvs.find((c) => c.source === "generated") ?? null;
  const uploadedCv  = cvs.find((c) => c.source === "upload") ?? null;
  const activeCv    = generatedCv ?? uploadedCv; // il principale da mostrare in cima

  // ── Upload ──────────────────────────────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch(`${BASE}api/cv/mine/upload`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Errore upload");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cvs-mine", userId] });
      queryClient.invalidateQueries({ queryKey: ["completion-me"] });
      setUploadError(null);
    },
    onError: (err: Error) => setUploadError(err.message),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) { setUploadError("File troppo grande (max 5 MB)"); return; }
    const allowed = [
      "application/pdf",
      "text/plain",
    ];
    if (!allowed.includes(file.type)) { setUploadError("Solo PDF o TXT"); return; }
    setUploadError(null);
    uploadMutation.mutate(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Generate ────────────────────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${BASE}api/cv/mine/generate`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Errore generazione");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cvs-mine", userId] });
      queryClient.invalidateQueries({ queryKey: ["completion-me"] });
      setGenerateError(null);
    },
    onError: (err: Error) => setGenerateError(err.message),
  });

  // ── Delete ──────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${BASE}api/cv/mine`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore eliminazione");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cvs-mine", userId] });
      queryClient.invalidateQueries({ queryKey: ["completion-me"] });
    },
  });

  // ── Download PDF (solo CV generati) ──────────────────────────────────
  function handleDownloadPdf() {
    const url = `${BASE}api/cv/${userId}/pdf`;
    const a = document.createElement("a");
    a.href = url;
    a.download = generatedCv?.filename ?? "CV_NorthStar.pdf";
    a.click();
  }

  const isBusy = uploadMutation.isPending || generateMutation.isPending || deleteMutation.isPending;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" /> Il mio CV
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* ── Loading ── */}
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Caricamento...
          </div>
        )}

        {/* ── CV generato (priorità visiva) ── */}
        {!isLoading && generatedCv && (
          <div className="flex items-start justify-between gap-3 p-3 rounded-xl border bg-primary/5 border-primary/20">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{generatedCv.filename}</p>
                <p className="text-xs text-muted-foreground">
                  Generato da profilo · {formatDate(generatedCv.uploadedAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleDownloadPdf}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                title="Scarica PDF"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
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

        {/* ── CV caricato (secondario se esiste anche il generato) ── */}
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
                <p className="text-xs text-muted-foreground">
                  Caricato manualmente · {formatDate(uploadedCv.uploadedAt)}
                </p>
              </div>
            </div>
            {!generatedCv && (
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={isBusy}
                className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-40 shrink-0"
                title="Elimina CV"
              >
                {deleteMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />}
              </button>
            )}
          </div>
        )}

        {/* ── Feedback operazioni ── */}
        {uploadMutation.isSuccess && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> CV caricato e analizzato con successo!
          </p>
        )}
        {generateMutation.isSuccess && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> CV generato dal tuo profilo NorthStar!
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

        {/* ── Empty state ── */}
        {!isLoading && cvs.length === 0 && !uploadMutation.isPending && !generateMutation.isPending && (
          <p className="text-xs text-muted-foreground bg-muted/40 rounded-xl p-3 leading-relaxed">
            Nessun CV presente. Carica il tuo CV esistente (PDF o TXT) oppure generane uno automaticamente dai dati del tuo profilo NorthStar.
          </p>
        )}

        {/* ── Azioni ── */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full gap-2 text-xs flex-1"
            disabled={isBusy}
            onClick={() => fileRef.current?.click()}
          >
            {uploadMutation.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Upload className="w-3.5 h-3.5" />}
            {uploadedCv ? "Sostituisci CV" : "Carica CV"}
          </Button>

          <Button
            size="sm"
            className="rounded-full gap-2 text-xs flex-1"
            disabled={isBusy}
            onClick={() => generateMutation.mutate()}
          >
            {generateMutation.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Sparkles className="w-3.5 h-3.5" />}
            {generatedCv ? "Rigenera CV" : "Genera da profilo"}
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground -mt-1">
          PDF o TXT · max 5 MB · Il CV generato include competenze, esperienze e settore dal tuo profilo
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          className="sr-only"
          onChange={handleFileChange}
          aria-label="Carica CV"
        />
      </CardContent>
    </Card>
  );
}
