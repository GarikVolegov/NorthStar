/**
 * ProfileEditPanel v3 — aggiunta sezione 'I tuoi progressi' (Passo 3).
 *
 * CHANGES vs v2:
 * - Sezione 0 'I tuoi progressi' aggiunta come PRIMO accordion (aperto di default)
 * - ProgressPanel montato con lazy-load al primo open
 * - onRetakeTest propagato verso RiasecProfileCard
 * - Sezioni riordinate: Progressi > Identità > Percorso > Preferenze > CV > RIASEC
 */
import React, { useState, useCallback, useRef } from "react";
import { RiasecProfileCard }  from "./RiasecProfileCard";
import { ProgressPanel }      from "./ProgressPanel";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ProfileData {
  name:                string;
  email:               string;
  avatarUrl:           string | null;
  timezone:            string;
  journeyType:         string;
  userMode:            string;
  workPreference:      string;
  autonomyPreference:  number;
  stabilityPreference: number;
  cvText:              string | null;
  isPublic:            boolean;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

// ── Constants ────────────────────────────────────────────────────────────────

const JOURNEY_OPTIONS = [
  { value: "indeciso",       label: "Ancora in esplorazione",     description: "Non ho chiaro il percorso, sto cercando direzione", emoji: "🧭" },
  { value: "in_transizione", label: "In transizione",             description: "Sto cambiando settore, ruolo o stile di vita",       emoji: "🔄" },
  { value: "in_crescita",    label: "In crescita attiva",         description: "Ho una direzione chiara, voglio accelerare",         emoji: "🚀" },
  { value: "autonomo",       label: "Indipendente / Imprenditore",description: "Costruisco qualcosa di mio, voglio scalare",         emoji: "🏗️" },
];
const MODE_OPTIONS = [
  { value: "explorer", label: "Explorer", description: "Voglio esplorare opzioni e scoprire cosa mi piace", emoji: "🔭" },
  { value: "builder",  label: "Builder",  description: "Voglio costruire competenze e progetti concreti",   emoji: "🛠️" },
  { value: "achiever", label: "Achiever", description: "Voglio raggiungere obiettivi misurabili e veloci",  emoji: "🏆" },
];
const WORK_OPTIONS = [
  { value: "remote",  label: "Remoto",        emoji: "🏠" },
  { value: "hybrid",  label: "Ibrido",        emoji: "🏭" },
  { value: "office",  label: "In ufficio",    emoji: "🏙️" },
  { value: "unknown", label: "Non so ancora", emoji: "🤷" },
];
const TIMEZONES = [
  "Europe/Rome","Europe/London","Europe/Berlin","Europe/Madrid",
  "America/New_York","America/Chicago","America/Los_Angeles",
  "Asia/Tokyo","Asia/Dubai","UTC",
];

// ── Hook ──────────────────────────────────────────────────────────────────────

function useProfileEdit(token: string, apiBase: string, initialData?: Partial<ProfileData>) {
  const def: ProfileData = {
    name:"", email:"", avatarUrl:null, timezone:"Europe/Rome",
    journeyType:"indeciso", userMode:"explorer", workPreference:"unknown",
    autonomyPreference:5, stabilityPreference:5, cvText:null, isPublic:false,
    ...initialData,
  };
  const [form,    setForm]   = useState<ProfileData>(def);
  const [status,  setStatus] = useState<SaveStatus>("idle");
  const [error,   setError]  = useState<string | null>(null);
  const [loading, setLoad]   = useState(!initialData);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (initialData) return;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/users/me`, { headers:{ Authorization:`Bearer ${token}` } });
        if (!res.ok) throw new Error(await res.text());
        setForm((f) => ({ ...f, ...(await res.json() as ProfileData) }));
      } catch(e) { setError(e instanceof Error ? e.message : "Errore"); }
      finally { setLoad(false); }
    })();
  }, []); // eslint-disable-line

  const update = useCallback(<K extends keyof ProfileData>(key: K, val: ProfileData[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (status === "saved") setStatus("idle");
  }, [status]);

  const save = useCallback(async () => {
    setStatus("saving"); setError(null);
    try {
      const res = await fetch(`${apiBase}/users/me`, {
        method:"PATCH",
        headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`},
        body: JSON.stringify({
          name:form.name, timezone:form.timezone, journeyType:form.journeyType,
          userMode:form.userMode, workPreference:form.workPreference,
          autonomyPreference:form.autonomyPreference, stabilityPreference:form.stabilityPreference,
          cvText:form.cvText, isPublic:form.isPublic,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Errore"); }
      setStatus("saved");
      savedTimer.current && clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setStatus("idle"), 2500);
    } catch(e) { setStatus("error"); setError(e instanceof Error ? e.message : "Errore"); }
  }, [form, token, apiBase]);

  const uploadAvatar = useCallback(async (file: File) => {
    const fd = new FormData(); fd.append("avatar", file);
    const res = await fetch(`${apiBase}/users/me/avatar`, {
      method:"POST", headers:{Authorization:`Bearer ${token}`}, body:fd,
    });
    if (!res.ok) throw new Error("Upload avatar fallito");
    const { avatarUrl } = await res.json() as { avatarUrl: string };
    setForm((f) => ({ ...f, avatarUrl }));
  }, [token, apiBase]);

  return { form, update, save, uploadAvatar, status, error, loading };
}

// ── UI sub-components ───────────────────────────────────────────────────────────

function SectionAccordion({ title, emoji, open, onToggle, children }: {
  title:string; emoji:string; open:boolean; onToggle:()=>void; children:React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors">
        <span className="flex items-center gap-2.5 text-sm font-semibold"><span>{emoji}</span>{title}</span>
        <svg className={`w-4 h-4 text-muted-foreground transition-transform ${open?"rotate-180":""}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && <div className="px-5 pb-5 pt-2 space-y-4 border-t border-border">{children}</div>}
    </div>
  );
}

function RadioCard({ value:_v, selected, emoji, label, description, onClick }: {
  value:string; selected:boolean; emoji:string; label:string; description:string; onClick:()=>void;
}) {
  return (
    <button onClick={onClick} className={`w-full text-left rounded-xl border p-3.5 transition-all ${
      selected ? "border-primary bg-primary/8 ring-1 ring-primary" : "border-border hover:border-primary/40 hover:bg-muted/30"
    }`}>
      <div className="flex items-center gap-2">
        <span className="text-xl">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 ${selected?"border-primary bg-primary":"border-muted-foreground/40"}`}>
          {selected && <div className="m-0.5 rounded-full bg-white h-2 w-2"/>}
        </div>
      </div>
    </button>
  );
}

function SliderField({ label, sublabelLeft, sublabelRight, value, onChange }: {
  label:string; sublabelLeft:string; sublabelRight:string; value:number; onChange:(v:number)=>void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium">{label}</label>
        <span className="text-xs font-semibold text-primary">{value}/10</span>
      </div>
      <input type="range" min={1} max={10} step={1} value={value}
        onChange={(e)=>onChange(Number(e.target.value))} className="w-full accent-primary cursor-pointer"/>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{sublabelLeft}</span><span>{sublabelRight}</span>
      </div>
    </div>
  );
}

function AvatarUploader({ name, avatarUrl, onUpload }: {
  name:string; avatarUrl:string|null; onUpload:(file:File)=>Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const initials = name.split(" ").slice(0,2).map((w)=>w[0]?.toUpperCase()??"" ).join("");
  async function handleFile(e:React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if(!file) return;
    if(file.size>2*1024*1024){setErr("Max 2MB");return;}
    setUploading(true);setErr("");
    try{await onUpload(file);}catch(ex){setErr(ex instanceof Error?ex.message:"Errore");}
    finally{setUploading(false);}
  }
  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        {avatarUrl
          ? <img src={avatarUrl} alt={name} className="h-16 w-16 rounded-2xl object-cover border border-border"/>
          : <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center"><span className="text-primary-foreground text-xl font-bold">{initials||"?"}</span></div>
        }
        {uploading&&<div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center"><div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"/></div>}
      </div>
      <div className="space-y-1">
        <button onClick={()=>inputRef.current?.click()} disabled={uploading}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">Cambia foto</button>
        {err&&<p className="text-xs text-red-500">{err}</p>}
        <p className="text-[10px] text-muted-foreground">JPG o PNG, max 2MB</p>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFile}/>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export interface ProfileEditPanelProps {
  token:         string;
  initialData?:  Partial<ProfileData>;
  apiBase?:      string;
  onSaved?:      (data:ProfileData) => void;
  onRetakeTest?: () => void;
  className?:    string;
}

export function ProfileEditPanel({
  token, initialData, apiBase="/api", onSaved, onRetakeTest, className="",
}: ProfileEditPanelProps) {
  const { form, update, save, uploadAvatar, status, error, loading } =
    useProfileEdit(token, apiBase, initialData);

  const [openSections, setOpenSections] = useState<Record<string,boolean>>({
    progress: true,   // ← aperto di default (Passo 3)
    identity: false,
    journey:  true,
    preferences: false,
    cv:       false,
    riasec:   false,
  });
  const [progressMounted, setProgressMounted] = useState(true);  // aperto subito
  const [riasecMounted,   setRiasecMounted]   = useState(false);

  function toggleSection(key: string) {
    const willOpen = !openSections[key];
    setOpenSections((s) => ({ ...s, [key]: willOpen }));
    if (key === "progress" && willOpen) setProgressMounted(true);
    if (key === "riasec"   && willOpen) setRiasecMounted(true);
  }

  async function handleSave() {
    await save();
    if (status !== "error") onSaved?.(form);
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent"/>
    </div>
  );

  return (
    <div className={`space-y-4 max-w-2xl mx-auto ${className}`}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Il tuo profilo</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Queste informazioni guidano Wendy nelle risposte</p>
        </div>
        <button onClick={handleSave} disabled={status==="saving"}
          className={`rounded-xl px-5 py-2 text-sm font-medium transition-all ${
            status==="saved" ? "bg-green-500 text-white" :
            status==="error" ? "bg-red-500 text-white" :
            "bg-primary text-primary-foreground hover:opacity-90"
          } disabled:opacity-50`}>
          {status==="saving"?"Salvataggio...": status==="saved"?"✓ Salvato": status==="error"?"✕ Errore":"Salva"}
        </button>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs text-red-700">{error}</div>}

      {/* ── SEZIONE 0: Progressi (Passo 3) ─────────────────────────────── */}
      <SectionAccordion title="I tuoi progressi" emoji="🔥" open={openSections.progress} onToggle={()=>toggleSection("progress")}>
        {progressMounted && <ProgressPanel token={token} apiBase={apiBase} />}
      </SectionAccordion>

      {/* ── SEZIONE 1: Identità ───────────────────────────────────────── */}
      <SectionAccordion title="Identità" emoji="👤" open={openSections.identity} onToggle={()=>toggleSection("identity")}>
        <AvatarUploader name={form.name} avatarUrl={form.avatarUrl} onUpload={uploadAvatar}/>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Nome</label>
            <input type="text" value={form.name} onChange={(e)=>update("name",e.target.value)} placeholder="Il tuo nome"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"/>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Fuso orario</label>
            <select value={form.timezone} onChange={(e)=>update("timezone",e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
              {TIMEZONES.map((tz)=><option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Profilo pubblico</p>
            <p className="text-xs text-muted-foreground">Rendi visibile il tuo profilo ad altri utenti</p>
          </div>
          <button onClick={()=>update("isPublic",!form.isPublic)}
            className={`relative h-6 w-11 rounded-full transition-colors ${form.isPublic?"bg-primary":"bg-muted"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.isPublic?"translate-x-5":"translate-x-0.5"}`}/>
          </button>
        </div>
      </SectionAccordion>

      {/* ── SEZIONE 2: Percorso ───────────────────────────────────────── */}
      <SectionAccordion title="Il tuo percorso" emoji="🧭" open={openSections.journey} onToggle={()=>toggleSection("journey")}>
        <div className="space-y-1">
          <label className="text-xs font-medium">Dove ti trovi ora?</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
            {JOURNEY_OPTIONS.map((opt)=>(
              <RadioCard key={opt.value} {...opt} selected={form.journeyType===opt.value} onClick={()=>update("journeyType",opt.value)}/>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Come preferisci lavorare con il coach?</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
            {MODE_OPTIONS.map((opt)=>(
              <RadioCard key={opt.value} {...opt} selected={form.userMode===opt.value} onClick={()=>update("userMode",opt.value)}/>
            ))}
          </div>
        </div>
      </SectionAccordion>

      {/* ── SEZIONE 3: Preferenze ─────────────────────────────────────── */}
      <SectionAccordion title="Preferenze lavorative" emoji="⚙️" open={openSections.preferences} onToggle={()=>toggleSection("preferences")}>
        <div className="space-y-1">
          <label className="text-xs font-medium">Modalità di lavoro preferita</label>
          <div className="grid grid-cols-4 gap-2 mt-1">
            {WORK_OPTIONS.map((opt)=>(
              <button key={opt.value} onClick={()=>update("workPreference",opt.value)}
                className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-xs font-medium transition-all ${
                  form.workPreference===opt.value?"border-primary bg-primary/8 text-primary":"border-border hover:border-primary/40"
                }`}>
                <span className="text-xl">{opt.emoji}</span>{opt.label}
              </button>
            ))}
          </div>
        </div>
        <SliderField label="Autonomia vs Struttura" sublabelLeft="Max struttura" sublabelRight="Max autonomia"
          value={form.autonomyPreference} onChange={(v)=>update("autonomyPreference",v)}/>
        <SliderField label="Stabilità vs Crescita rapida" sublabelLeft="Stabilità" sublabelRight="Crescita aggressiva"
          value={form.stabilityPreference} onChange={(v)=>update("stabilityPreference",v)}/>
      </SectionAccordion>

      {/* ── SEZIONE 4: CV ────────────────────────────────────────────── */}
      <SectionAccordion title="CV / Background" emoji="📎" open={openSections.cv} onToggle={()=>toggleSection("cv")}>
        <p className="text-xs text-muted-foreground">
          Incolla il tuo CV, bio o esperienza professionale in testo libero.
          Wendy lo usa per darti consigli più precisi. L’IA estrae le informazioni chiave in background.
        </p>
        <textarea rows={8} value={form.cvText??""} onChange={(e)=>update("cvText",e.target.value||null)}
          placeholder="Es. Sono uno sviluppatore con 3 anni di esperienza in React e Node.js..."
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm resize-none"/>
        {form.cvText && form.cvText.length>50 && (
          <p className="text-[10px] text-muted-foreground">✨ Dopo il salvataggio Wendy analizza il testo e ne estrae le competenze chiave</p>
        )}
      </SectionAccordion>

      {/* ── SEZIONE 5: RIASEC (Passo 2) ──────────────────────────────── */}
      <SectionAccordion title="Il tuo profilo RIASEC" emoji="🧠" open={openSections.riasec} onToggle={()=>toggleSection("riasec")}>
        {riasecMounted && (
          <RiasecProfileCard token={token} apiBase={apiBase} onRetake={onRetakeTest}/>
        )}
      </SectionAccordion>

      {/* Bottom save */}
      <div className="pb-8">
        <button onClick={handleSave} disabled={status==="saving"}
          className={`w-full rounded-xl py-3 text-sm font-medium transition-all ${
            status==="saved"?"bg-green-500 text-white":"bg-primary text-primary-foreground hover:opacity-90"
          } disabled:opacity-50`}>
          {status==="saving"?"Salvataggio in corso...": status==="saved"?"✓ Profilo salvato":"Salva modifiche"}
        </button>
      </div>
    </div>
  );
}
