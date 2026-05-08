/**
 * CvSection — Upload CV + Genera da profilo
 *
 * Endpoints usati:
 *   GET    /api/cv/mine          → { cvs: CvMeta[] }
 *   POST   /api/cv/upload        → { cv: CvMeta }     (multipart form-data)
 *   POST   /api/cv/generate      → { cv: CvMeta }     (genera da dati profilo)
 *   DELETE /api/cv/:id           → 204
 *
 * CvMeta: { id, filename, uploadedAt, source: 'upload'|'generated', parsedContent?: string }
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
  id: number;
  filename: string;
  uploadedAt: string;
  source: "upload" | "generated";
  parsedContent?: string;
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

  // ── Fetch CVs ────────────────────────────────────────────────────────────
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
  const activeCv = cvs[0] ?? null; // il più recente

  // ── Upload ───────────────────────────────────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch(`${BASE}api/cv/upload`, {
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
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"];
    if (!allowed.includes(file.type)) { setUploadError("Solo PDF o DOCX"); return; }
    setUploadError(null);
    uploadMutation.mutate(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Generate ─────────────────────────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${BASE}api/cv/generate`, { method: "POST" });
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

  // ── Delete ───────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`${BASE}api/cv/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore eliminazione");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cvs-mine", userId] });
      queryClient.invalidateQueries({ queryKey: ["completion-me"] });
    },
  });

  // ── Download (testo) ──────────────────────────────────────────────────────
  function handleDownload(cv: CvMeta) {
    if (!cv.parsedContent) return;
    const blob = new Blob([cv.parsedContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = cv.filename.replace(/\.(pdf|docx?)$/i, ".txt") || "cv.txt";
    a.click();
    URL.revokeObjectURL(url);
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

        {/* ── CV attivo ── */}
        {!isLoading && activeCv && (
          <div className="flex items-start justify-between gap-3 p-3 rounded-xl border bg-muted/30">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                activeCv.source === "generated" ? "bg-primary/10" : "bg-emerald-50",
              )}>
                {activeCv.source === "generated"
                  ? <Sparkles className="w-4 h-4 text-primary" />
                  : <FileText className="w-4 h-4 text-emerald-600" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{activeCv.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {activeCv.source === "generated" ? "Generato da profilo" : "Caricato manualmente"} · {formatDate(activeCv.uploadedAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {activeCv.parsedContent && (
                <button
                  onClick={() => handleDownload(activeCv)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  title="Scarica testo CV"
                >
                  <Download className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
              <button
                onClick={() => deleteMutation.mutate(activeCv.id)}
                disabled={isBusy}
                className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-40"
                title="Elimina CV"
              >
                {deleteMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  : <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />}
              </button>
            </div>
          </div>
        )}

        {/* ── Operazioni riuscite ── */}
        {uploadMutation.isSuccess && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> CV caricato con successo!
          </p>
        )}
        {generateMutation.isSuccess && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> CV generato dal tuo profilo!
          </p>
        )}

        {/* ── Errori ── */}
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
        {!isLoading && !activeCv && !uploadMutation.isPending && !generateMutation.isPending && (
          <p className="text-xs text-muted-foreground bg-muted/40 rounded-xl p-3 leading-relaxed">
            Nessun CV presente. Carica il tuo CV esistente oppure generane uno automaticamente dai dati del tuo profilo NorthStar.
          </p>
        )}

        {/* ── Azioni ── */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Upload */}
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
            {activeCv ? "Sostituisci CV" : "Carica CV"}
          </Button>

          {/* Genera */}
          <Button
            size="sm"
            className="rounded-full gap-2 text-xs flex-1"
            disabled={isBusy}
            onClick={() => generateMutation.mutate()}
          >
            {generateMutation.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Sparkles className="w-3.5 h-3.5" />}
            Genera da profilo
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground -mt-1">
          PDF o DOCX · max 5 MB · I dati del profilo includono esperienze, competenze e settore confermato
        </p>

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          onChange={handleFileChange}
          aria-label="Carica CV"
        />
      </CardContent>
    </Card>
  );
}
