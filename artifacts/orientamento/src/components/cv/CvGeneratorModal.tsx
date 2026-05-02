import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  X, Loader2, Printer, RefreshCw, Sparkles, AlertCircle,
  Pencil, Eye, Plus, Trash2, ChevronDown, ChevronUp, Check,
  User, Briefcase, GraduationCap, Wrench, Award, Globe,
  Save, CheckCircle2, Clock, History, FolderOpen, PenLine,
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

export interface GeneratedCv {
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
          {cv.personalInfo.name || "Nome Cognome"}
        </h1>
        {cv.personalInfo.title && (
          <p style={{ margin: "6px 0 0", fontSize: "14px", color: "#86efac", fontWeight: "500" }}>
            {cv.personalInfo.title}
          </p>
        )}
        {cv.targetRole && cv.targetRole !== cv.personalInfo.title && (
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
            Target: {cv.targetRole}
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "16px" }}>
          {cv.personalInfo.email && (
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>✉ {cv.personalInfo.email}</span>
          )}
          {cv.personalInfo.phone && (
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>✆ {cv.personalInfo.phone}</span>
          )}
          {cv.personalInfo.location && (
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>⌖ {cv.personalInfo.location}</span>
          )}
          {cv.personalInfo.linkedin && (
            <span style={{ fontSize: "12px", color: "#86efac" }}>
              in {cv.personalInfo.linkedin.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, "")}
            </span>
          )}
          {cv.personalInfo.website && (
            <span style={{ fontSize: "12px", color: "#86efac" }}>⌘ {cv.personalInfo.website}</span>
          )}
        </div>
      </div>

      {/* Two-column body */}
      <div style={{ display: "flex" }}>
        {/* Left column */}
        <div style={{ width: "38%", background: "#f8faf9", borderRight: "1px solid #e5e7eb", padding: "28px 24px", flexShrink: 0 }}>
          {cv.skills.length > 0 && (
            <CvSection title="Competenze">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {cv.skills.map((s) => (
                  <span key={s} style={{ fontSize: "11px", background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: "999px", padding: "3px 10px", fontWeight: "500" }}>{s}</span>
                ))}
              </div>
            </CvSection>
          )}
          {cv.tools.length > 0 && (
            <CvSection title="Strumenti">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {cv.tools.map((t) => (
                  <span key={t} style={{ fontSize: "11px", background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", borderRadius: "999px", padding: "3px 10px", fontWeight: "500" }}>{t}</span>
                ))}
              </div>
            </CvSection>
          )}
          {cv.languages.length > 0 && (
            <CvSection title="Lingue">
              {cv.languages.map((l) => (
                <div key={l.language} style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>{l.language}</span>
                  <span style={{ fontSize: "11px", color: "#6b7280", background: "#f3f4f6", borderRadius: "999px", padding: "2px 8px" }}>{l.level}</span>
                </div>
              ))}
            </CvSection>
          )}
          {cv.certifications.length > 0 && (
            <CvSection title="Certificazioni">
              {cv.certifications.map((c) => (
                <div key={c} style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                  <span style={{ color: "#1a3a2a", fontSize: "14px" }}>✦</span>
                  <span style={{ fontSize: "12px", color: "#374151", lineHeight: "1.5" }}>{c}</span>
                </div>
              ))}
            </CvSection>
          )}
          <div style={{ padding: "12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", marginTop: "24px" }}>
            <p style={{ margin: 0, fontSize: "10px", color: "#15803d", textAlign: "center", fontWeight: "500" }}>✦ Generato con NorthStar</p>
          </div>
        </div>

        {/* Right column */}
        <div style={{ flex: 1, padding: "28px 32px" }}>
          {cv.summary && (
            <CvSection title="Profilo Professionale">
              <p style={{ fontSize: "13px", color: "#4b5563", lineHeight: "1.7", margin: 0 }}>{cv.summary}</p>
            </CvSection>
          )}
          {cv.experience.length > 0 && (
            <CvSection title="Esperienza Professionale">
              {cv.experience.map((e) => (
                <div key={e.id} style={{ marginBottom: "18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>{e.title}</p>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6b7280" }}>
                        {e.company}{e.location ? ` · ${e.location}` : ""}
                      </p>
                    </div>
                    <span style={{ fontSize: "11px", color: "#9ca3af", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "999px", padding: "2px 10px", flexShrink: 0 }}>{e.period}</span>
                  </div>
                  {e.description && (
                    <div style={{ fontSize: "12px", color: "#4b5563", lineHeight: "1.7", marginTop: "6px" }}>
                      {e.description.split("\n").map((line, i) => (
                        <p key={i} style={{ margin: "3px 0" }}>
                          {line.startsWith("→") ? <><span style={{ color: "#1a3a2a" }}>→</span> {line.slice(1).trim()}</> : line}
                        </p>
                      ))}
                    </div>
                  )}
                  {e.skills.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>
                      {e.skills.map((s) => (
                        <span key={s} style={{ fontSize: "10px", background: "#f3f4f6", color: "#6b7280", borderRadius: "999px", padding: "2px 8px" }}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CvSection>
          )}
          {cv.education.length > 0 && (
            <CvSection title="Formazione">
              {cv.education.map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#111827" }}>{e.degree}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6b7280" }}>{e.institution}</p>
                    {e.description && <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#9ca3af" }}>{e.description}</p>}
                  </div>
                  <span style={{ fontSize: "11px", color: "#9ca3af", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "999px", padding: "2px 10px", flexShrink: 0 }}>{e.year}</span>
                </div>
              ))}
            </CvSection>
          )}
        </div>
      </div>
    </div>
  );
}

function CvSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <h3 style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase", color: "#1a3a2a", marginBottom: "10px", borderBottom: "2px solid #1a3a2a", paddingBottom: "6px", margin: "0 0 10px 0" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Tag input ──────────────────────────────────────────────────────────
function TagInput({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  function add() {
    const val = input.trim();
    if (val && !items.includes(val)) { onChange([...items, val]); }
    setInput("");
  }
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {items.map((item) => (
          <span key={item} className="flex items-center gap-1 text-xs bg-primary/8 text-primary border border-primary/20 rounded-full px-2.5 py-0.5 font-medium">
            {item}
            <button type="button" onClick={() => onChange(items.filter((i) => i !== item))} className="hover:text-destructive ml-0.5">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder || "Aggiungi..."}
          className="h-8 text-xs rounded-lg"
        />
        <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg px-2.5" onClick={add}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Edit Section wrapper ──────────────────────────────────────────────
function EditBlock({ icon: Icon, title, children, defaultOpen = true }: {
  icon: React.ElementType; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="w-4 h-4 text-primary" />{title}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="p-4 space-y-3 bg-background">{children}</div>}
    </div>
  );
}

// ── Full Edit Panel ───────────────────────────────────────────────────
function EditPanel({ cv, onChange }: { cv: GeneratedCv; onChange: (cv: GeneratedCv) => void }) {
  const set = useCallback((patch: Partial<GeneratedCv>) => onChange({ ...cv, ...patch }), [cv, onChange]);
  const setPI = (patch: Partial<GeneratedCv["personalInfo"]>) =>
    set({ personalInfo: { ...cv.personalInfo, ...patch } });

  // Experience helpers
  const updateExp = (id: string, patch: Partial<GeneratedCv["experience"][0]>) =>
    set({ experience: cv.experience.map((e) => e.id === id ? { ...e, ...patch } : e) });
  const addExp = () => set({
    experience: [...cv.experience, {
      id: `exp-${Date.now()}`, title: "", company: "", period: "", location: "", description: "", skills: [],
    }],
  });
  const delExp = (id: string) => set({ experience: cv.experience.filter((e) => e.id !== id) });

  // Education helpers
  const updateEdu = (id: string, patch: Partial<GeneratedCv["education"][0]>) =>
    set({ education: cv.education.map((e) => e.id === id ? { ...e, ...patch } : e) });
  const addEdu = () => set({
    education: [...cv.education, { id: `edu-${Date.now()}`, degree: "", institution: "", year: "" }],
  });
  const delEdu = (id: string) => set({ education: cv.education.filter((e) => e.id !== id) });

  // Language helpers
  const updateLang = (i: number, patch: Partial<{ language: string; level: string }>) =>
    set({ languages: cv.languages.map((l, idx) => idx === i ? { ...l, ...patch } : l) });
  const addLang = () => set({ languages: [...cv.languages, { language: "", level: "" }] });
  const delLang = (i: number) => set({ languages: cv.languages.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-3">

      {/* Personal info */}
      <EditBlock icon={User} title="Informazioni personali">
        <div className="grid grid-cols-2 gap-2">
          {([
            ["name", "Nome completo"],
            ["title", "Titolo professionale"],
            ["email", "Email"],
            ["phone", "Telefono"],
            ["location", "Città / Paese"],
            ["linkedin", "LinkedIn URL"],
            ["website", "Sito web"],
          ] as [keyof GeneratedCv["personalInfo"], string][]).map(([field, label]) => (
            <div key={field} className={field === "title" || field === "linkedin" ? "col-span-2" : ""}>
              <Label className="text-[11px] text-muted-foreground mb-1 block">{label}</Label>
              <Input
                value={(cv.personalInfo[field] as string) ?? ""}
                onChange={(e) => setPI({ [field]: e.target.value })}
                className="h-8 text-xs rounded-lg"
                placeholder={label}
              />
            </div>
          ))}
        </div>
      </EditBlock>

      {/* Summary */}
      <EditBlock icon={Sparkles} title="Profilo professionale">
        <Textarea
          value={cv.summary}
          onChange={(e) => set({ summary: e.target.value })}
          className="text-xs rounded-lg min-h-[100px] resize-none"
          placeholder="Scrivi un sommario professionale..."
        />
      </EditBlock>

      {/* Experience */}
      <EditBlock icon={Briefcase} title={`Esperienza (${cv.experience.length})`} defaultOpen={cv.experience.length > 0}>
        <div className="space-y-4">
          {cv.experience.map((exp, idx) => (
            <div key={exp.id} className="border rounded-lg p-3 space-y-2 bg-muted/20">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Esperienza {idx + 1}</span>
                <button onClick={() => delExp(exp.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Ruolo *</Label>
                  <Input value={exp.title} onChange={(e) => updateExp(exp.id, { title: e.target.value })} className="h-8 text-xs rounded-lg" placeholder="es. Software Engineer" />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Azienda *</Label>
                  <Input value={exp.company} onChange={(e) => updateExp(exp.id, { company: e.target.value })} className="h-8 text-xs rounded-lg" placeholder="Nome azienda" />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Periodo *</Label>
                  <Input value={exp.period} onChange={(e) => updateExp(exp.id, { period: e.target.value })} className="h-8 text-xs rounded-lg" placeholder="Gen 2022 – Presente" />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Sede</Label>
                  <Input value={exp.location ?? ""} onChange={(e) => updateExp(exp.id, { location: e.target.value })} className="h-8 text-xs rounded-lg" placeholder="Milano" />
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">Descrizione</Label>
                <Textarea
                  value={exp.description}
                  onChange={(e) => updateExp(exp.id, { description: e.target.value })}
                  className="text-xs rounded-lg min-h-[72px] resize-none"
                  placeholder="Usa → per i bullet point: → Descrizione attività..."
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">Competenze (premi Invio)</Label>
                <TagInput items={exp.skills} onChange={(skills) => updateExp(exp.id, { skills })} placeholder="es. React, Python..." />
              </div>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" className="w-full rounded-lg gap-1.5 h-8" onClick={addExp}>
            <Plus className="w-3.5 h-3.5" /> Aggiungi esperienza
          </Button>
        </div>
      </EditBlock>

      {/* Education */}
      <EditBlock icon={GraduationCap} title={`Formazione (${cv.education.length})`} defaultOpen={cv.education.length > 0}>
        <div className="space-y-3">
          {cv.education.map((edu, idx) => (
            <div key={edu.id} className="border rounded-lg p-3 space-y-2 bg-muted/20">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Titolo {idx + 1}</span>
                <button onClick={() => delEdu(edu.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">Titolo di studio *</Label>
                <Input value={edu.degree} onChange={(e) => updateEdu(edu.id, { degree: e.target.value })} className="h-8 text-xs rounded-lg" placeholder="es. Laurea Magistrale in Informatica" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Istituto *</Label>
                  <Input value={edu.institution} onChange={(e) => updateEdu(edu.id, { institution: e.target.value })} className="h-8 text-xs rounded-lg" placeholder="Università di..." />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1 block">Anno</Label>
                  <Input value={edu.year} onChange={(e) => updateEdu(edu.id, { year: e.target.value })} className="h-8 text-xs rounded-lg" placeholder="2022" />
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">Note (voto, specializzazione…)</Label>
                <Input value={edu.description ?? ""} onChange={(e) => updateEdu(edu.id, { description: e.target.value })} className="h-8 text-xs rounded-lg" placeholder="110/110 con lode" />
              </div>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" className="w-full rounded-lg gap-1.5 h-8" onClick={addEdu}>
            <Plus className="w-3.5 h-3.5" /> Aggiungi titolo di studio
          </Button>
        </div>
      </EditBlock>

      {/* Skills */}
      <EditBlock icon={Sparkles} title="Competenze" defaultOpen={false}>
        <TagInput items={cv.skills} onChange={(skills) => set({ skills })} placeholder="es. Machine Learning..." />
      </EditBlock>

      {/* Tools */}
      <EditBlock icon={Wrench} title="Strumenti" defaultOpen={false}>
        <TagInput items={cv.tools} onChange={(tools) => set({ tools })} placeholder="es. TensorFlow, Figma..." />
      </EditBlock>

      {/* Languages */}
      <EditBlock icon={Globe} title="Lingue" defaultOpen={false}>
        <div className="space-y-2">
          {cv.languages.map((l, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input value={l.language} onChange={(e) => updateLang(i, { language: e.target.value })} className="h-8 text-xs rounded-lg flex-1" placeholder="Lingua" />
              <Input value={l.level} onChange={(e) => updateLang(i, { level: e.target.value })} className="h-8 text-xs rounded-lg w-28" placeholder="Livello" />
              <button onClick={() => delLang(i)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" className="w-full rounded-lg gap-1.5 h-8" onClick={addLang}>
            <Plus className="w-3.5 h-3.5" /> Aggiungi lingua
          </Button>
        </div>
      </EditBlock>

      {/* Certifications */}
      <EditBlock icon={Award} title="Certificazioni" defaultOpen={false}>
        <TagInput items={cv.certifications} onChange={(certifications) => set({ certifications })} placeholder="es. AWS Solutions Architect..." />
      </EditBlock>

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
  const queryClient = useQueryClient();
  const { data: profile } = useProfileForCv(userId);
  const [generated, setGenerated] = useState<GeneratedCv | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("preview");
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    (cvData as any)?.lastSaved ?? null
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // ── Version history state ──────────────────────────────────────────
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<Array<{
    id: string; name: string; targetRole: string; savedAt: string;
  }>>([]);
  const [versionSaveStatus, setVersionSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [newVersionName, setNewVersionName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [loadingVersionId, setLoadingVersionId] = useState<string | null>(null);

  async function fetchVersions() {
    try {
      const res = await fetch(`${BASE}api/cv/${userId}/versions`);
      const data = await res.json();
      setVersions(data.versions ?? []);
    } catch { /* silent */ }
  }

  async function saveAsVersion() {
    if (!generated) return;
    setVersionSaveStatus("saving");
    try {
      const res = await fetch(`${BASE}api/cv/${userId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generated, name: newVersionName || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVersions((prev) => [data.version, ...prev]);
      setNewVersionName("");
      setVersionSaveStatus("saved");
      setTimeout(() => setVersionSaveStatus("idle"), 2500);
    } catch {
      setVersionSaveStatus("error");
      setTimeout(() => setVersionSaveStatus("idle"), 2500);
    }
  }

  async function renameVersion(id: string) {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    try {
      await fetch(`${BASE}api/cv/${userId}/versions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      setVersions((prev) => prev.map((v) => v.id === id ? { ...v, name: renameValue.trim() } : v));
    } catch { /* silent */ } finally {
      setRenamingId(null);
    }
  }

  async function deleteVersion(id: string) {
    try {
      await fetch(`${BASE}api/cv/${userId}/versions/${id}`, { method: "DELETE" });
      setVersions((prev) => prev.filter((v) => v.id !== id));
    } catch { /* silent */ }
  }

  async function loadVersion(id: string) {
    setLoadingVersionId(id);
    try {
      const res = await fetch(`${BASE}api/cv/${userId}/versions/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGenerated(data.version.data);
      setHasUnsavedChanges(false);
      setSaveStatus("idle");
      setShowVersions(false);
    } catch { /* silent */ } finally {
      setLoadingVersionId(null);
    }
  }

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
    setHasUnsavedChanges(false);
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
      setIsEditing(false);
      setSaveStatus("idle");
    } catch (err: any) {
      setError(err.message || "Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!generated) return;
    setSaveStatus("saving");
    try {
      const res = await fetch(`${BASE}api/cv/${userId}/save`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generated }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore nel salvataggio");
      setLastSavedAt(data.savedAt);
      setSaveStatus("saved");
      setHasUnsavedChanges(false);
      // Refresh the CvSection so it shows the new saved state
      queryClient.invalidateQueries({ queryKey: ["cv", userId] });
      // Reset "saved" badge after 3 seconds
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  // Handle CV changes and mark as unsaved
  function handleCvChange(updated: GeneratedCv) {
    setGenerated(updated);
    setHasUnsavedChanges(true);
    setSaveStatus("idle");
  }

  // On open: if a saved generated CV exists, load it directly — skip AI generation
  useEffect(() => {
    const savedGenerated = (cvData as any)?.generated;
    if (savedGenerated && typeof savedGenerated === "object") {
      setGenerated(savedGenerated);
    } else {
      generate();
    }
  }, []);

  // Load version list whenever the panel opens
  useEffect(() => {
    if (showVersions) fetchVersions();
  }, [showVersions]);

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "cv-print-style";
    style.textContent = `
      @media print {
        body > *:not(#cv-print-portal) { display: none !important; }
        #cv-print-portal { position: fixed; top: 0; left: 0; width: 100%; z-index: 99999; }
        #cv-print-portal > * { display: none !important; }
        #cv-print-portal #cv-preview-scroll { display: block !important; overflow: visible !important; padding: 0 !important; }
        #cv-document { box-shadow: none !important; margin: 0 !important; width: 100% !important; }
        @page { margin: 0; size: A4; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById("cv-print-style")?.remove(); };
  }, []);

  const hasContent = !!generated && !loading;
  const hasSavedCv = !!(cvData as any)?.generated;

  function formatSavedAt(iso: string) {
    return new Date(iso).toLocaleString("it-IT", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div
      id="cv-print-portal"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-background/97 border-b shadow-sm print:hidden gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground leading-tight">CV Generato con NorthStar</p>
            <div className="flex items-center gap-2 flex-wrap">
              {generated?.targetRole && (
                <span className="text-xs text-muted-foreground">Target: {generated.targetRole}</span>
              )}
              {lastSavedAt && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <Clock className="w-2.5 h-2.5" />
                  Salvato {formatSavedAt(lastSavedAt)}
                </span>
              )}
              {hasUnsavedChanges && (
                <span className="text-xs text-amber-600 font-medium">● Modifiche non salvate</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Mobile tab switcher */}
          {hasContent && (
            <div className="flex rounded-lg bg-muted p-0.5 md:hidden">
              <button
                onClick={() => setMobileTab("edit")}
                className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all", mobileTab === "edit" ? "bg-white shadow text-foreground" : "text-muted-foreground")}
              >
                <Pencil className="w-3 h-3" /> Modifica
              </button>
              <button
                onClick={() => setMobileTab("preview")}
                className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all", mobileTab === "preview" ? "bg-white shadow text-foreground" : "text-muted-foreground")}
              >
                <Eye className="w-3 h-3" /> Anteprima
              </button>
            </div>
          )}

          {/* Desktop: edit toggle */}
          {hasContent && (
            <Button
              size="sm"
              variant={isEditing ? "default" : "outline"}
              className="rounded-full gap-1.5 hidden md:flex"
              onClick={() => setIsEditing((v) => !v)}
            >
              {isEditing
                ? <><Check className="w-3.5 h-3.5" />Fine modifica</>
                : <><Pencil className="w-3.5 h-3.5" />Modifica</>}
            </Button>
          )}

          {/* Save button — shown when editing or there are unsaved changes */}
          {hasContent && (isEditing || hasUnsavedChanges) && (
            <Button
              size="sm"
              variant={saveStatus === "saved" ? "outline" : "default"}
              className={cn(
                "rounded-full gap-1.5",
                saveStatus === "saved" && "text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-50",
                saveStatus === "error" && "text-destructive border-destructive/30 bg-destructive/5",
              )}
              onClick={save}
              disabled={saveStatus === "saving" || saveStatus === "saved"}
            >
              {saveStatus === "saving" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saveStatus === "saved" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              {saveStatus === "error" && <AlertCircle className="w-3.5 h-3.5" />}
              {saveStatus === "idle" && <Save className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
                {saveStatus === "saving" ? "Salvataggio…"
                  : saveStatus === "saved" ? "Salvato!"
                  : saveStatus === "error" ? "Errore"
                  : "Salva modifiche"}
              </span>
            </Button>
          )}

          {/* Versioni */}
          {hasContent && (
            <Button
              size="sm"
              variant={showVersions ? "default" : "outline"}
              className="rounded-full gap-1.5"
              onClick={() => setShowVersions((v) => !v)}
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                Versioni{versions.length > 0 ? ` (${versions.length})` : ""}
              </span>
            </Button>
          )}

          {/* Rigenera */}
          {hasContent && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full gap-1.5"
              onClick={generate}
              disabled={loading}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              <span className="hidden sm:inline">Rigenera</span>
            </Button>
          )}

          {hasContent && (
            <Button size="sm" className="rounded-full gap-1.5" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Stampa / PDF</span>
            </Button>
          )}

          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors ml-0.5">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center w-full gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Generazione CV in corso…</p>
              <p className="text-sm text-muted-foreground mt-1">
                Integro il grafo delle conoscenze{cvData ? " e il tuo CV" : ""} con il profilo RIASEC
              </p>
            </div>
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="max-w-md mx-auto mt-20 text-center w-full">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-destructive" />
            </div>
            <p className="font-semibold text-foreground mb-2">Errore nella generazione</p>
            <p className="text-sm text-muted-foreground mb-5">{error}</p>
            <Button onClick={generate} className="rounded-full">Riprova</Button>
          </div>
        )}

        {/* Content */}
        {generated && !loading && (
          <>
            {/* Desktop: side-by-side */}
            <div className="hidden md:flex flex-1 overflow-hidden">
              {/* Edit panel */}
              {isEditing && !showVersions && (
                <div className="w-[400px] flex-shrink-0 overflow-y-auto border-r bg-background p-4">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                    <Pencil className="w-4 h-4 text-primary" />
                    <h2 className="font-semibold text-sm text-foreground">Modifica il CV</h2>
                    <span className="text-xs text-muted-foreground ml-auto">Preview live →</span>
                  </div>
                  <EditPanel cv={generated} onChange={handleCvChange} />
                  <div className="mt-4 pt-4 border-t sticky bottom-0 bg-background pb-2">
                    <Button
                      className={cn("w-full rounded-xl gap-2", saveStatus === "saved" && "bg-emerald-600 hover:bg-emerald-700")}
                      onClick={save}
                      disabled={saveStatus === "saving" || (!hasUnsavedChanges && saveStatus !== "idle")}
                    >
                      {saveStatus === "saving" && <Loader2 className="w-4 h-4 animate-spin" />}
                      {saveStatus === "saved" && <CheckCircle2 className="w-4 h-4" />}
                      {saveStatus === "error" && <AlertCircle className="w-4 h-4" />}
                      {saveStatus === "idle" && <Save className="w-4 h-4" />}
                      {saveStatus === "saving" ? "Salvataggio in corso…" : saveStatus === "saved" ? "Salvato con successo!" : saveStatus === "error" ? "Errore — riprova" : "Salva modifiche"}
                    </Button>
                    {hasUnsavedChanges && saveStatus === "idle" && (
                      <p className="text-center text-xs text-amber-600 mt-2">Hai modifiche non salvate</p>
                    )}
                    {lastSavedAt && saveStatus !== "saving" && (
                      <p className="text-center text-xs text-muted-foreground mt-1.5">Ultima modifica: {formatSavedAt(lastSavedAt)}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Versions panel */}
              {showVersions && (
                <div className="w-[360px] flex-shrink-0 flex flex-col border-r bg-background">
                  <div className="flex items-center gap-2 px-4 py-3 border-b">
                    <History className="w-4 h-4 text-primary" />
                    <h2 className="font-semibold text-sm text-foreground">Versioni salvate</h2>
                    <span className="ml-auto text-xs text-muted-foreground">{versions.length}/20</span>
                    <button onClick={() => setShowVersions(false)} className="p-1 rounded hover:bg-muted ml-1">
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>

                  {/* Save current as new version */}
                  <div className="px-4 py-3 border-b bg-muted/30">
                    <p className="text-xs font-medium text-foreground mb-2">Salva versione corrente</p>
                    <div className="flex gap-2">
                      <Input
                        value={newVersionName}
                        onChange={(e) => setNewVersionName(e.target.value)}
                        placeholder={`CV ${new Date().toLocaleDateString("it-IT")}`}
                        className="h-8 text-xs rounded-lg flex-1"
                        onKeyDown={(e) => { if (e.key === "Enter") saveAsVersion(); }}
                      />
                      <Button
                        size="sm"
                        className={cn("h-8 rounded-lg gap-1.5 shrink-0", versionSaveStatus === "saved" && "bg-emerald-600")}
                        onClick={saveAsVersion}
                        disabled={versionSaveStatus === "saving" || !generated}
                      >
                        {versionSaveStatus === "saving" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {versionSaveStatus === "saved" && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {versionSaveStatus === "idle" && <Save className="w-3.5 h-3.5" />}
                        {versionSaveStatus === "error" && <AlertCircle className="w-3.5 h-3.5" />}
                        {versionSaveStatus === "saved" ? "Salvato!" : "Salva"}
                      </Button>
                    </div>
                  </div>

                  {/* Version list */}
                  <div className="flex-1 overflow-y-auto">
                    {versions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <FolderOpen className="w-10 h-10 text-muted-foreground/40 mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">Nessuna versione salvata</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Usa il form qui sopra per salvare una versione del CV corrente</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {versions.map((v) => (
                          <div key={v.id} className="px-4 py-3 hover:bg-muted/30 transition-colors group">
                            {renamingId === v.id ? (
                              <div className="flex gap-2 items-center mb-1">
                                <Input
                                  autoFocus
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  className="h-7 text-xs rounded-md flex-1"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") renameVersion(v.id);
                                    if (e.key === "Escape") setRenamingId(null);
                                  }}
                                />
                                <button onClick={() => renameVersion(v.id)} className="p-1 rounded hover:bg-primary/10 text-primary">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setRenamingId(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-start gap-1.5 mb-1">
                                <p className="text-sm font-medium text-foreground leading-tight flex-1 truncate">{v.name}</p>
                                <button
                                  onClick={() => { setRenamingId(v.id); setRenameValue(v.name); }}
                                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all shrink-0 mt-0.5"
                                  title="Rinomina"
                                >
                                  <PenLine className="w-3 h-3 text-muted-foreground" />
                                </button>
                              </div>
                            )}
                            {v.targetRole && (
                              <p className="text-xs text-muted-foreground mb-2">🎯 {v.targetRole}</p>
                            )}
                            <div className="flex items-center gap-1.5 justify-between">
                              <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {formatSavedAt(v.savedAt)}
                              </span>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-[11px] rounded-md gap-1"
                                  onClick={() => loadVersion(v.id)}
                                  disabled={loadingVersionId === v.id}
                                >
                                  {loadingVersionId === v.id
                                    ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                    : <FolderOpen className="w-2.5 h-2.5" />}
                                  Carica
                                </Button>
                                <button
                                  onClick={() => deleteVersion(v.id)}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                  title="Elimina versione"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Preview */}
              <div id="cv-preview-scroll" className="flex-1 overflow-auto py-8 px-6 bg-gray-100">
                <CvDocument cv={generated} />
              </div>
            </div>

            {/* Mobile: tabbed */}
            <div className="flex md:hidden flex-1 overflow-hidden">
              {mobileTab === "edit" ? (
                <div className="flex-1 overflow-y-auto p-4 bg-background">
                  {showVersions ? (
                    /* Mobile versions panel */
                    <div>
                      <div className="flex items-center gap-2 mb-3 pb-3 border-b">
                        <History className="w-4 h-4 text-primary" />
                        <h2 className="font-semibold text-sm">Versioni salvate</h2>
                        <button onClick={() => setShowVersions(false)} className="ml-auto p-1 rounded hover:bg-muted">
                          <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                      <div className="flex gap-2 mb-3">
                        <Input
                          value={newVersionName}
                          onChange={(e) => setNewVersionName(e.target.value)}
                          placeholder={`CV ${new Date().toLocaleDateString("it-IT")}`}
                          className="h-8 text-xs rounded-lg flex-1"
                        />
                        <Button size="sm" className="h-8 rounded-lg gap-1 shrink-0" onClick={saveAsVersion} disabled={versionSaveStatus === "saving"}>
                          {versionSaveStatus === "saving" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          {versionSaveStatus === "saved" ? "Salvato!" : "Salva"}
                        </Button>
                      </div>
                      {versions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">Nessuna versione salvata</p>
                      ) : (
                        <div className="space-y-2">
                          {versions.map((v) => (
                            <div key={v.id} className="border rounded-lg p-3">
                              <p className="text-sm font-medium mb-0.5 truncate">{v.name}</p>
                              {v.targetRole && <p className="text-xs text-muted-foreground mb-2">🎯 {v.targetRole}</p>}
                              <div className="flex gap-2 justify-end">
                                <Button size="sm" variant="outline" className="h-7 text-xs rounded-md gap-1" onClick={() => loadVersion(v.id)} disabled={loadingVersionId === v.id}>
                                  {loadingVersionId === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FolderOpen className="w-3 h-3" />}
                                  Carica
                                </Button>
                                <button onClick={() => deleteVersion(v.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                        <Pencil className="w-4 h-4 text-primary" />
                        <h2 className="font-semibold text-sm">Modifica CV</h2>
                        <span className="text-xs text-muted-foreground ml-auto">Vai su Anteprima per vedere</span>
                      </div>
                      <EditPanel cv={generated} onChange={handleCvChange} />
                      <div className="mt-4 pt-4 border-t">
                        <Button
                          className={cn("w-full rounded-xl gap-2", saveStatus === "saved" && "bg-emerald-600")}
                          onClick={save}
                          disabled={saveStatus === "saving"}
                        >
                          {saveStatus === "saving" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          {saveStatus === "saving" ? "Salvataggio…" : saveStatus === "saved" ? "Salvato!" : "Salva modifiche"}
                        </Button>
                        {lastSavedAt && (
                          <p className="text-center text-xs text-muted-foreground mt-2">Ultima modifica: {formatSavedAt(lastSavedAt)}</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div id="cv-preview-scroll" className="flex-1 overflow-auto py-4 px-2 bg-gray-100">
                  <div className="scale-[0.45] origin-top-left" style={{ width: "222%", transformOrigin: "top left" }}>
                    <CvDocument cv={generated} />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      {hasContent && (
        <div className="text-center py-2 text-xs text-white/60 bg-black/25 print:hidden">
          {isEditing
            ? hasUnsavedChanges
              ? '● Modifiche non salvate — clicca "Salva modifiche" per conservarle'
              : 'Modifica i campi — il CV si aggiorna in tempo reale'
            : lastSavedAt
            ? `CV salvato il ${formatSavedAt(lastSavedAt)} · Riaprendo il modal troverai questa versione`
            : '"Modifica" per editare · "Stampa / PDF" per esportare · "Salva" per conservare le modifiche'}
        </div>
      )}
    </div>
  );
}
