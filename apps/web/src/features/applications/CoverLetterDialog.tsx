import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { postJson } from "@/lib/apiClient";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { AlertCircle, Building2, Copy, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Application } from "./applicationTypes";

const BASE = import.meta.env.BASE_URL || "/";
type CoverLetterResponse = { error?: string; text?: string };

function useCoverLetterText(locale: string, key: string, source: string, context = "Cover letter dialog UI copy") {
  return useDynamicTranslation({ locale, key, source, context });
}

export function CoverLetterDialog({ app, onClose }: { app: Application; onClose: () => void }) {
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? "it").slice(0, 2);
  const [jobDescription, setJobDescription] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const title = useCoverLetterText(locale, "candidature.coverLetter.title", "Lettera di presentazione AI");
  const description = useCoverLetterText(locale, "candidature.coverLetter.description", "Genera una lettera di presentazione per questa candidatura.");
  const jobDescriptionLabel = useCoverLetterText(locale, "candidature.coverLetter.jobDescriptionLabel", "Descrizione posizione");
  const optionalLabel = useCoverLetterText(locale, "candidature.coverLetter.optional", "(facoltativo)");
  const jobDescriptionPlaceholder = useCoverLetterText(
    locale,
    "candidature.coverLetter.jobDescriptionPlaceholder",
    "Incolla la descrizione dell'annuncio per una lettera piu personalizzata...",
  );
  const generateLabel = useCoverLetterText(locale, "candidature.coverLetter.generate", "Genera lettera AI");
  const regenerateLabel = useCoverLetterText(locale, "candidature.coverLetter.regenerate", "Rigenera lettera");
  const loadingLabel = useCoverLetterText(locale, "candidature.coverLetter.loading", "Generazione in corso...");
  const emptyTextError = useCoverLetterText(locale, "candidature.coverLetter.emptyTextError", "La lettera AI non e disponibile. Riprova tra poco.");
  const genericError = useCoverLetterText(locale, "candidature.coverLetter.genericError", "Errore generazione");
  const generatedLabel = useCoverLetterText(locale, "candidature.coverLetter.generatedLabel", "Lettera generata");
  const copyLabel = useCoverLetterText(locale, "candidature.coverLetter.copy", "Copia");
  const copiedLabel = useCoverLetterText(locale, "candidature.coverLetter.copied", "Copiato!");
  const closeLabel = useCoverLetterText(locale, "candidature.coverLetter.close", "Chiudi");

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
      const generatedText = data.text?.trim() ?? "";
      if (!generatedText) throw new Error(emptyTextError);
      setText(generatedText);
    } catch (error) {
      setError(error instanceof Error ? error.message : genericError);
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
            <Sparkles className="w-4 h-4 text-primary" /> {title}
          </DialogTitle>
          <DialogDescription className="sr-only">{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-medium">{app.company}</span>
            <span className="text-muted-foreground">-</span>
            <span className="text-muted-foreground">{app.role}</span>
          </div>
          <div>
            <Label className="text-xs font-semibold mb-1.5 block">
              {jobDescriptionLabel}{" "}
              <span className="font-normal text-muted-foreground">{optionalLabel}</span>
            </Label>
            <Textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder={jobDescriptionPlaceholder}
              className="min-h-[80px] rounded-xl text-sm resize-none"
            />
          </div>
          <Button onClick={generate} disabled={loading} className="w-full rounded-xl gap-2">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {loadingLabel}</>
              : <><Sparkles className="w-4 h-4" /> {text ? regenerateLabel : generateLabel}</>}
          </Button>
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20" role="alert">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
          {text && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">{generatedLabel}</Label>
                <button onClick={copyToClipboard} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Copy className="w-3 h-3" /> {copied ? copiedLabel : copyLabel}
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
          <Button variant="outline" className="rounded-xl" onClick={onClose}>{closeLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
