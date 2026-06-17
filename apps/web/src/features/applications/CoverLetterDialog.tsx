import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { postJson } from "@/lib/apiClient";
import { AlertCircle, Building2, Copy, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

import type { Application } from "./applicationTypes";

const BASE = import.meta.env.BASE_URL || "/";
type CoverLetterResponse = { error?: string; text?: string };

export function CoverLetterDialog({ app, onClose }: { app: Application; onClose: () => void }) {
  const [jobDescription, setJobDescription] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const data = await postJson<CoverLetterResponse>(`${BASE}api/cover-letter/generate`, {
        company: app.company,
        role: app.role,
        jobDescription,
      });
      if (data.error) throw new Error(data.error);
      setText(data.text ?? "");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Errore generazione");
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Lettera di presentazione AI
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-medium">{app.company}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{app.role}</span>
          </div>
          <div>
            <Label className="text-xs font-semibold mb-1.5 block">
              Descrizione posizione{" "}
              <span className="font-normal text-muted-foreground">(facoltativo)</span>
            </Label>
            <Textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Incolla la descrizione dell'annuncio per una lettera più personalizzata…"
              className="min-h-[80px] rounded-xl text-sm resize-none"
            />
          </div>
          <Button onClick={generate} disabled={loading} className="w-full rounded-xl gap-2">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generazione in corso…</>
              : <><Sparkles className="w-4 h-4" /> {text ? "Rigenera lettera" : "Genera lettera AI"}</>}
          </Button>
          {error &&
            (error.includes("Pro") ? (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                <p className="text-xs text-foreground">{error}</p>
                <Button asChild size="sm" className="rounded-lg w-full gap-1.5">
                  <Link href="/premium">
                    <Sparkles className="w-3.5 h-3.5" /> Passa a Pro
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            ))}
          {text && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Lettera generata</Label>
                <button onClick={copyToClipboard} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Copy className="w-3 h-3" /> {copied ? "Copiato!" : "Copia"}
                </button>
              </div>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[240px] rounded-xl text-sm"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={onClose}>Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
