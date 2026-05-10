import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";
import {
  Linkedin, Sparkles, CheckCircle2, Circle, ChevronRight,
  Briefcase, GraduationCap, Award, Wrench, FileText,
  Loader2, AlertCircle, Copy, ArrowLeft,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";

type Step = "instructions" | "paste" | "analyzing" | "preview" | "done";

interface WorkExp {
  company: string; role: string; start_date: string; end_date: string;
  description: string; location: string; is_current: boolean;
}
interface Education {
  institution: string; degree: string; field: string;
  start_year: string; end_year: string;
}
interface Cert { name: string; issuer: string; issued_date: string; credential_url: string; }

interface ExtractedProfile {
  full_name: string; headline: string; location: string; summary: string;
  skills: string[]; work_experiences: WorkExp[]; education: Education[];
  certifications: Cert[]; languages: string[];
  sector_suggestion: string; career_level: string;
  years_of_experience: number; north_star_notes: string;
}

const LINKEDIN_INSTRUCTIONS = [
  { icon: "1️⃣", text: "Vai sul tuo profilo LinkedIn (linkedin.com/in/tuo-nome)" },
  { icon: "2️⃣", text: "Clicca su \"...\" → \"Salva in PDF\" oppure usa Ctrl+A / Cmd+A per selezionare tutto" },
  { icon: "3️⃣", text: "Copia il testo selezionato e incollalo nel passaggio successivo" },
  { icon: "4️⃣", text: "L'AI analizza il testo e estrae esperienze, skill, certificazioni e formazione" },
];

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 justify-center mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={cn(
          "h-1.5 rounded-full transition-all duration-300",
          i < current ? "bg-primary w-6" : i === current ? "bg-primary w-4" : "bg-border w-3"
        )} />
      ))}
    </div>
  );
}

function SkillPill({ label }: { label: string }) {
  return (
    <span className="text-[11px] px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full">
      {label}
    </span>
  );
}

interface LinkedInImportWizardProps {
  open: boolean;
  onClose: () => void;
}

export function LinkedInImportWizard({ open, onClose }: LinkedInImportWizardProps) {
  const [step, setStep] = useState<Step>("instructions");
  const [pastedText, setPastedText] = useState("");
  const [extracted, setExtracted] = useState<ExtractedProfile | null>(null);
  const [importCerts, setImportCerts] = useState(true);
  const [importSummary, setImportSummary] = useState(true);
  const [importResult, setImportResult] = useState<{
    certsImported: number; skillsFound: number;
    experiencesFound: number; educationFound: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const qc = useQueryClient();

  const extractMut = useMutation({
    mutationFn: async () => {
      setError(null);
      const r = await apiFetch(`${BASE}api/linkedin/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileText: pastedText }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? "Errore durante l'analisi");
      }
      return r.json() as Promise<{ data: ExtractedProfile }>;
    },
    onMutate: () => setStep("analyzing"),
    onSuccess: (result) => {
      setExtracted(result.data);
      setStep("preview");
    },
    onError: (err: Error) => {
      setError(err.message);
      setStep("paste");
    },
  });

  const importMut = useMutation({
    mutationFn: async () => {
      const r = await apiFetch(`${BASE}api/linkedin/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileText: pastedText,
          extractedData: extracted,
          importCertifications: importCerts,
          importSummary,
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? "Errore durante l'importazione");
      }
      return r.json();
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep("done");
      qc.invalidateQueries({ queryKey: ["certifications"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  function reset() {
    setStep("instructions");
    setPastedText("");
    setExtracted(null);
    setImportResult(null);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Linkedin className="h-5 w-5 text-[#0077B5]" />
            Importa da LinkedIn
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Incolla il testo del tuo profilo — l'AI estrae tutto automaticamente
          </DialogDescription>
        </DialogHeader>

        {/* ── STEP: INSTRUCTIONS ── */}
        {step === "instructions" && (
          <div className="space-y-5">
            <StepIndicator current={0} total={4} />
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-foreground text-sm">Come funziona</h3>
              {LINKEDIN_INSTRUCTIONS.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-base shrink-0">{item.icon}</span>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="text-primary font-semibold">Privacy garantita:</span> il testo viene inviato
                  all'AI solo per l'estrazione e non viene condiviso con terze parti. Puoi
                  sempre eliminare i dati importati dal tuo profilo.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep("paste")} className="rounded-full gap-2">
                Continua <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP: PASTE ── */}
        {step === "paste" && (
          <div className="space-y-4">
            <StepIndicator current={1} total={4} />
            <div>
              <label className="text-sm font-semibold text-foreground block mb-2">
                Incolla qui il testo del tuo profilo LinkedIn
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={`Mario Rossi\nSoftware Engineer @ Acme Corp\nMilano, Italia\n\nSommario\nIngegnere con 5 anni di esperienza in sviluppo web...\n\nEsperienza\nSoftware Engineer - Acme Corp\nGen 2021 - Presente\n...\n\nFormazione\nUniversità degli Studi di Milano\nLaurea Magistrale in Informatica, 2020\n\nCertificazioni\nAWS Certified Developer - Amazon Web Services, 2022\n\nCompetenze\nJavaScript · React · Node.js · Python · AWS`}
                className="w-full h-52 resize-none rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/40 p-4 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                {pastedText.length} caratteri incollati
                {pastedText.length > 0 && pastedText.length < 50 && (
                  <span className="text-amber-400 ml-2">— incolla più testo per risultati migliori</span>
                )}
              </p>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" className="rounded-full gap-1 text-muted-foreground" onClick={() => setStep("instructions")}>
                <ArrowLeft className="h-3.5 w-3.5" /> Indietro
              </Button>
              <Button
                disabled={pastedText.trim().length < 50 || extractMut.isPending}
                onClick={() => extractMut.mutate()}
                className="rounded-full gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Analizza con AI
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP: ANALYZING ── */}
        {step === "analyzing" && (
          <div className="py-16 text-center space-y-4">
            <div className="relative mx-auto w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <Linkedin className="absolute inset-0 m-auto h-7 w-7 text-[#0077B5]" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Analisi in corso…</p>
              <p className="text-sm text-muted-foreground mt-1">
                L'AI sta leggendo il tuo profilo ed estraendo esperienze, skill e certificazioni
              </p>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              {["Esperienze", "Formazione", "Skill", "Certificazioni"].map((label, i) => (
                <div key={label} className="flex flex-col items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full border border-border animate-pulse bg-card" style={{ animationDelay: `${i * 150}ms` }} />
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP: PREVIEW ── */}
        {step === "preview" && extracted && (
          <div className="space-y-5">
            <StepIndicator current={2} total={4} />

            {/* Header card */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  {extracted.full_name && (
                    <h3 className="font-bold text-foreground">{extracted.full_name}</h3>
                  )}
                  {extracted.headline && (
                    <p className="text-sm text-muted-foreground">{extracted.headline}</p>
                  )}
                  {extracted.location && (
                    <p className="text-xs text-muted-foreground mt-0.5">📍 {extracted.location}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {extracted.career_level && (
                    <span className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 font-medium">
                      {extracted.career_level}
                    </span>
                  )}
                  {extracted.years_of_experience > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{extracted.years_of_experience} anni di exp.</p>
                  )}
                </div>
              </div>
              {extracted.sector_suggestion && (
                <p className="text-xs mt-2 text-muted-foreground">
                  Settore rilevato: <span className="text-foreground font-medium">{extracted.sector_suggestion}</span>
                </p>
              )}
            </div>

            {/* AI notes */}
            {extracted.north_star_notes && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide">Insight AI</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{extracted.north_star_notes}</p>
              </div>
            )}

            {/* Data extracted grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="h-3.5 w-3.5 text-primary" />
                  <span className="font-semibold text-foreground text-xs">Esperienze</span>
                  <span className="ml-auto text-xs text-primary font-bold">{extracted.work_experiences.length}</span>
                </div>
                {extracted.work_experiences.slice(0, 3).map((w, i) => (
                  <div key={i} className="text-xs text-muted-foreground truncate py-0.5 border-t border-border first:border-0">
                    {w.role} @ {w.company}
                  </div>
                ))}
                {extracted.work_experiences.length > 3 && (
                  <p className="text-xs text-muted-foreground/60 mt-1">+{extracted.work_experiences.length - 3} altre</p>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <GraduationCap className="h-3.5 w-3.5 text-primary" />
                  <span className="font-semibold text-foreground text-xs">Formazione</span>
                  <span className="ml-auto text-xs text-primary font-bold">{extracted.education.length}</span>
                </div>
                {extracted.education.slice(0, 3).map((e, i) => (
                  <div key={i} className="text-xs text-muted-foreground truncate py-0.5 border-t border-border first:border-0">
                    {e.degree ? `${e.degree} — ` : ""}{e.institution}
                  </div>
                ))}
              </div>
            </div>

            {/* Skills */}
            {extracted.skills.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Wrench className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">
                    {extracted.skills.length} Skill rilevate
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {extracted.skills.slice(0, 18).map((s) => <SkillPill key={s} label={s} />)}
                  {extracted.skills.length > 18 && (
                    <span className="text-xs text-muted-foreground self-center">+{extracted.skills.length - 18}</span>
                  )}
                </div>
              </div>
            )}

            {/* Certifications */}
            {extracted.certifications.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Award className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">
                    {extracted.certifications.length} Certificazioni trovate
                  </span>
                </div>
                <div className="space-y-1.5">
                  {extracted.certifications.map((c, i) => (
                    <div key={i} className="text-xs text-muted-foreground flex items-center gap-2 py-1 border-t border-border first:border-0">
                      <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                      <span className="truncate">{c.name} — {c.issuer}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Import options */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground">Cosa importare in NorthStar</p>
              {[
                { key: "certs", label: `Certificazioni (${extracted.certifications.length})`, checked: importCerts, set: setImportCerts, disabled: extracted.certifications.length === 0 },
                { key: "summary", label: "Riepilogo professionale e skill nel CV", checked: importSummary, set: setImportSummary, disabled: false },
              ].map(({ key, label, checked, set, disabled }) => (
                <label key={key} className={cn("flex items-center gap-3 cursor-pointer", disabled && "opacity-40 cursor-not-allowed")}>
                  <button
                    onClick={() => !disabled && set(!checked)}
                    className={cn(
                      "w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all",
                      checked && !disabled ? "bg-primary border-primary" : "border-border"
                    )}
                    disabled={disabled}
                  >
                    {checked && !disabled && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                  </button>
                  <span className="text-sm text-muted-foreground">{label}</span>
                </label>
              ))}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" className="rounded-full gap-1 text-muted-foreground" onClick={() => setStep("paste")}>
                <ArrowLeft className="h-3.5 w-3.5" /> Indietro
              </Button>
              <Button
                onClick={() => importMut.mutate()}
                disabled={importMut.isPending}
                className="rounded-full gap-2"
              >
                {importMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {importMut.isPending ? "Importazione…" : "Conferma importazione"}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP: DONE ── */}
        {step === "done" && importResult && (
          <div className="py-10 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">Importazione completata!</h3>
              <p className="text-muted-foreground text-sm mt-1">Il tuo profilo NorthStar è stato aggiornato</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {[
                { label: "Certificazioni", value: importResult.certsImported, icon: Award },
                { label: "Skill", value: importResult.skillsFound, icon: Wrench },
                { label: "Esperienze", value: importResult.experiencesFound, icon: Briefcase },
                { label: "Formazione", value: importResult.educationFound, icon: GraduationCap },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-xl border border-border bg-card p-3">
                  <Icon className="h-4 w-4 text-primary mx-auto mb-1" />
                  <div className="text-2xl font-black text-foreground">{value}</div>
                  <div className="text-[10px] text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>

            {extracted?.north_star_notes && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide">Insight AI</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{extracted.north_star_notes}</p>
              </div>
            )}

            <Button onClick={handleClose} className="rounded-full px-8">
              Chiudi
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
