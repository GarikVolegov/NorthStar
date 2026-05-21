/**
 * CvEditorDrawer
 * Drawer full-height per modificare manualmente ogni campo del CV generato.
 * Salva via PATCH /api/cv/mine/generated
 */
import { Button } from "@/components/ui/button";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent,
  SheetDescription,
  SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { patchJson } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  Globe,
  GraduationCap,
  Loader2,
  Plus,
  Save,
  Trash2,
  User,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";

export interface GeneratedCv {
  personalInfo: {
    name: string; title?: string; email?: string; phone?: string;
    location?: string; linkedin?: string; website?: string;
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
  targetRole?: string;
  template?: string;
  generatedAt?: string;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function TagEditor({
  label, items, onChange,
}: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState("");
  function add() {
    const v = input.trim();
    if (v && !items.includes(v)) { onChange([...items, v]); setInput(""); }
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {items.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-muted text-xs px-2 py-0.5 rounded-full">
            {it}
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="hover:text-destructive">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Aggiungi..."
          className="h-7 text-xs"
        />
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={add}>
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function Section({
  icon, title, children, defaultOpen = false,
}: { icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
        <span className="flex items-center gap-2 text-sm font-medium">
          {icon} {title}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1 pt-3 pb-1 space-y-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  userId: number;
  initialCv: GeneratedCv;
}

export function CvEditorDrawer({ open, onClose, userId, initialCv }: Props) {
  const queryClient = useQueryClient();
  const [cv, setCv] = useState<GeneratedCv>(initialCv);
  const [saved, setSaved] = useState(false);

  // Reset when drawer re-opens with fresh data
  useEffect(() => {
    if (open) { setCv(initialCv); setSaved(false); }
  }, [open, initialCv]);

  const pi = cv.personalInfo;
  const setPI = (k: keyof typeof pi, v: string) =>
    setCv((c) => ({ ...c, personalInfo: { ...c.personalInfo, [k]: v } }));

  // ── Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: GeneratedCv) => {
      return patchJson<unknown>(`${BASE}api/cv/mine/generated`, { generated: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cvs-mine", userId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  // ── Esperienze helpers
  const addExp = useCallback(() => {
    setCv((c) => ({
      ...c,
      experience: [...c.experience, { id: uid(), title: "", company: "", period: "", location: "", description: "", skills: [] }],
    }));
  }, []);
  const removeExp = useCallback((id: string) =>
    setCv((c) => ({ ...c, experience: c.experience.filter((e) => e.id !== id) })), []);
  const setExp = useCallback(<K extends keyof GeneratedCv["experience"][number]>(
    id: string,
    k: K,
    v: GeneratedCv["experience"][number][K],
  ) =>
    setCv((c) => ({ ...c, experience: c.experience.map((e) => e.id === id ? { ...e, [k]: v } : e) })), []);

  // ── Educazione helpers
  const addEdu = useCallback(() =>
    setCv((c) => ({ ...c, education: [...c.education, { id: uid(), degree: "", institution: "", year: "", description: "" }] })), []);
  const removeEdu = useCallback((id: string) =>
    setCv((c) => ({ ...c, education: c.education.filter((e) => e.id !== id) })), []);
  const setEdu = useCallback((id: string, k: string, v: string) =>
    setCv((c) => ({ ...c, education: c.education.map((e) => e.id === id ? { ...e, [k]: v } : e) })), []);

  // ── Lingue helpers
  const addLang = useCallback(() =>
    setCv((c) => ({ ...c, languages: [...c.languages, { language: "", level: "" }] })), []);
  const removeLang = useCallback((i: number) =>
    setCv((c) => ({ ...c, languages: c.languages.filter((_, j) => j !== i) })), []);
  const setLang = useCallback((i: number, k: "language" | "level", v: string) =>
    setCv((c) => ({ ...c, languages: c.languages.map((l, j) => j === i ? { ...l, [k]: v } : l) })), []);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:w-[520px] sm:max-w-[520px] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <SheetTitle className="text-base">Modifica CV</SheetTitle>
          <SheetDescription className="text-xs">
            Le modifiche vengono salvate solo quando premi <strong>Salva</strong>.
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

          {/* ── Info personali */}
          <Section icon={<User className="w-4 h-4" />} title="Informazioni personali" defaultOpen>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["name", "Nome completo"],
                ["title", "Titolo / Ruolo"],
                ["email", "Email"],
                ["phone", "Telefono"],
                ["location", "Sede"],
                ["linkedin", "LinkedIn"],
                ["website", "Sito web"],
              ] as [keyof typeof pi, string][]).map(([k, lbl]) => (
                <div key={k} className={k === "name" || k === "title" ? "col-span-2" : ""}>
                  <Label className="text-xs text-muted-foreground mb-1 block">{lbl}</Label>
                  <Input
                    value={(pi[k] as string) ?? ""}
                    onChange={(e) => setPI(k, e.target.value)}
                    className="h-8 text-xs"
                    placeholder={lbl}
                  />
                </div>
              ))}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Ruolo target</Label>
              <Input
                value={cv.targetRole ?? ""}
                onChange={(e) => setCv((c) => ({ ...c, targetRole: e.target.value }))}
                className="h-8 text-xs" placeholder="es. Frontend Developer"
              />
            </div>
          </Section>

          {/* ── Sommario */}
          <Section icon={<span className="text-base">✦</span>} title="Profilo / Sommario">
            <Textarea
              value={cv.summary ?? ""}
              onChange={(e) => setCv((c) => ({ ...c, summary: e.target.value }))}
              rows={4}
              className="text-xs resize-none"
              placeholder="Breve descrizione professionale..."
            />
          </Section>

          {/* ── Esperienze */}
          <Section icon={<Briefcase className="w-4 h-4" />} title={`Esperienze (${cv.experience.length})`} defaultOpen>
            <div className="space-y-4">
              {cv.experience.map((exp) => (
                <div key={exp.id} className="relative border rounded-xl p-3 space-y-2 bg-background">
                  <button
                    onClick={() => removeExp(exp.id)}
                    className="absolute top-2.5 right-2.5 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="grid grid-cols-2 gap-2 pr-6">
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Titolo ruolo</Label>
                      <Input value={exp.title} onChange={(e) => setExp(exp.id, "title", e.target.value)} className="h-8 text-xs mt-1" placeholder="es. Software Developer" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Azienda</Label>
                      <Input value={exp.company} onChange={(e) => setExp(exp.id, "company", e.target.value)} className="h-8 text-xs mt-1" placeholder="Azienda" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Periodo</Label>
                      <Input value={exp.period} onChange={(e) => setExp(exp.id, "period", e.target.value)} className="h-8 text-xs mt-1" placeholder="2023 – oggi" />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Sede (opz.)</Label>
                      <Input value={exp.location ?? ""} onChange={(e) => setExp(exp.id, "location", e.target.value)} className="h-8 text-xs mt-1" placeholder="Milano, IT" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Descrizione</Label>
                    <Textarea
                      value={exp.description}
                      onChange={(e) => setExp(exp.id, "description", e.target.value)}
                      rows={3} className="text-xs resize-none mt-1"
                      placeholder="Usa → per bullet points"
                    />
                  </div>
                  <TagEditor
                    label="Skill associate"
                    items={exp.skills}
                    onChange={(v) => setExp(exp.id, "skills", v)}
                  />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs rounded-full" onClick={addExp}>
                <Plus className="w-3.5 h-3.5" /> Aggiungi esperienza
              </Button>
            </div>
          </Section>

          {/* ── Educazione */}
          <Section icon={<GraduationCap className="w-4 h-4" />} title={`Formazione (${cv.education.length})`}>
            <div className="space-y-3">
              {cv.education.map((edu) => (
                <div key={edu.id} className="relative border rounded-xl p-3 space-y-2 bg-background">
                  <button
                    onClick={() => removeEdu(edu.id)}
                    className="absolute top-2.5 right-2.5 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="grid grid-cols-2 gap-2 pr-6">
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Titolo / Laurea</Label>
                      <Input value={edu.degree} onChange={(e) => setEdu(edu.id, "degree", e.target.value)} className="h-8 text-xs mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Istituto</Label>
                      <Input value={edu.institution} onChange={(e) => setEdu(edu.id, "institution", e.target.value)} className="h-8 text-xs mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Anno</Label>
                      <Input value={edu.year} onChange={(e) => setEdu(edu.id, "year", e.target.value)} className="h-8 text-xs mt-1" placeholder="2022" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Note (opz.)</Label>
                    <Input value={edu.description ?? ""} onChange={(e) => setEdu(edu.id, "description", e.target.value)} className="h-8 text-xs mt-1" />
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs rounded-full" onClick={addEdu}>
                <Plus className="w-3.5 h-3.5" /> Aggiungi formazione
              </Button>
            </div>
          </Section>

          {/* ── Skill & Tools */}
          <Section icon={<Wrench className="w-4 h-4" />} title="Competenze & Strumenti">
            <TagEditor label="Competenze" items={cv.skills} onChange={(v) => setCv((c) => ({ ...c, skills: v }))} />
            <TagEditor label="Strumenti / Tecnologie" items={cv.tools} onChange={(v) => setCv((c) => ({ ...c, tools: v }))} />
          </Section>

          {/* ── Lingue */}
          <Section icon={<Globe className="w-4 h-4" />} title={`Lingue (${cv.languages.length})`}>
            <div className="space-y-2">
              {cv.languages.map((l, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input value={l.language} onChange={(e) => setLang(i, "language", e.target.value)}
                    className="h-8 text-xs flex-1" placeholder="Italiano" />
                  <Input value={l.level} onChange={(e) => setLang(i, "level", e.target.value)}
                    className="h-8 text-xs w-28" placeholder="Madrelingua" />
                  <button onClick={() => removeLang(i)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs rounded-full" onClick={addLang}>
                <Plus className="w-3.5 h-3.5" /> Aggiungi lingua
              </Button>
            </div>
          </Section>

          {/* ── Certificazioni */}
          <Section icon={<Award className="w-4 h-4" />} title="Certificazioni">
            <TagEditor label="Certificazioni" items={cv.certifications} onChange={(v) => setCv((c) => ({ ...c, certifications: v }))} />
          </Section>

        </div>

        {/* Footer fisso */}
        <div className="shrink-0 border-t px-4 py-3 flex items-center justify-between gap-2 bg-background">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> Salvato!
            </span>
          )}
          {!saved && <span />}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="rounded-full text-xs" onClick={onClose}>
              Annulla
            </Button>
            <Button
              size="sm"
              className="rounded-full gap-1.5 text-xs"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate(cv)}
            >
              {saveMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Save className="w-3.5 h-3.5" />}
              Salva
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
