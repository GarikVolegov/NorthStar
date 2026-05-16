import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw, Loader2, Plus, Edit3, Trash2, X, Save,
  Briefcase, Users, GraduationCap, BookOpen, ChevronDown, ChevronUp,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";

type Tab = "sectors" | "professions" | "education-paths" | "growth-articles";

function useAdminFetch<T>(tab: Tab, adminKey: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/admin/catalogs/${tab}`, {
        headers: { "x-admin-key": adminKey },
      });
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  }, [tab, adminKey]);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { data, setData, loading, refresh: fetch_ };
}

// ─── Generic JSON field editor (comma-separated for arrays) ───────────────────
function ArrayField({ label, value, onChange }: {
  label: string; value: string[]; onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label} (separati da virgola)</label>
      <Input
        className="mt-1 text-xs"
        value={value.join(", ")}
        onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
      />
    </div>
  );
}

// ─── Sectors ──────────────────────────────────────────────────────────────────
interface Sector {
  id: number; name: string; description: string; icon: string; color: string;
  automationRisk: string; trend: string; growthRate: number;
  avgSalaryMin: number; avgSalaryMax: number;
}

function SectorForm({ initial, adminKey, onSaved, onCancel }: {
  initial?: Sector; adminKey: string; onSaved: () => void; onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "briefcase");
  const [color, setColor] = useState(initial?.color ?? "hsl(var(--chart-4))");
  const [automationRisk, setAutomationRisk] = useState(initial?.automationRisk ?? "medium");
  const [trend, setTrend] = useState(initial?.trend ?? "stable");
  const [growthRate, setGrowthRate] = useState(String(initial?.growthRate ?? 5));
  const [salaryMin, setSalaryMin] = useState(String(initial?.avgSalaryMin ?? 25000));
  const [salaryMax, setSalaryMax] = useState(String(initial?.avgSalaryMax ?? 50000));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const url = initial ? `${BASE}api/admin/catalogs/sectors/${initial.id}` : `${BASE}api/admin/catalogs/sectors`;
      const method = initial ? "PUT" : "POST";
      await fetch(url, {
        method, headers: { "x-admin-key": adminKey, "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, icon, color, automationRisk, trend, growthRate: Number(growthRate), avgSalaryMin: Number(salaryMin), avgSalaryMax: Number(salaryMax) }),
      });
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <Card className="border-primary/30 border-2">
      <CardContent className="pt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-medium text-muted-foreground">Nome</label><Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Icona</label><Input value={icon} onChange={(e) => setIcon(e.target.value)} className="mt-1" /></div>
        </div>
        <div><label className="text-xs font-medium text-muted-foreground">Descrizione</label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={2} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs font-medium text-muted-foreground">Rischio automazione</label>
            <select value={automationRisk} onChange={(e) => setAutomationRisk(e.target.value)} className="mt-1 w-full text-sm border rounded-md px-2 py-1.5 bg-background">
              <option value="low">Basso</option><option value="medium">Medio</option><option value="high">Alto</option>
            </select></div>
          <div><label className="text-xs font-medium text-muted-foreground">Trend</label>
            <select value={trend} onChange={(e) => setTrend(e.target.value)} className="mt-1 w-full text-sm border rounded-md px-2 py-1.5 bg-background">
              <option value="declining">In calo</option><option value="stable">Stabile</option><option value="growing">In crescita</option><option value="booming">Boom</option>
            </select></div>
          <div><label className="text-xs font-medium text-muted-foreground">Crescita %</label><Input type="number" value={growthRate} onChange={(e) => setGrowthRate(e.target.value)} className="mt-1" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-medium text-muted-foreground">Stipendio min (€)</label><Input type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Stipendio max (€)</label><Input type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} className="mt-1" /></div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={saving || !name.trim()}>
            {saving ? <Loader2 size={13} className="animate-spin mr-1" /> : <Save size={13} className="mr-1" />}
            {initial ? "Aggiorna" : "Crea"}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>Annulla</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Professions ──────────────────────────────────────────────────────────────
interface Profession {
  id: number; title: string; sector: string; description?: string;
  salaryRange: string; growthOutlook: string; isActive: boolean;
}

function ProfessionForm({ initial, adminKey, onSaved, onCancel }: {
  initial?: Profession; adminKey: string; onSaved: () => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [sector, setSector] = useState(initial?.sector ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [salaryRange, setSalaryRange] = useState(initial?.salaryRange ?? "25.000–45.000 €");
  const [growthOutlook, setGrowthOutlook] = useState(initial?.growthOutlook ?? "stable");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const url = initial ? `${BASE}api/admin/catalogs/professions/${initial.id}` : `${BASE}api/admin/catalogs/professions`;
      const method = initial ? "PUT" : "POST";
      await fetch(url, {
        method, headers: { "x-admin-key": adminKey, "Content-Type": "application/json" },
        body: JSON.stringify({ title, sector, description, salaryRange, growthOutlook }),
      });
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <Card className="border-primary/30 border-2">
      <CardContent className="pt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-medium text-muted-foreground">Titolo</label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Settore</label><Input value={sector} onChange={(e) => setSector(e.target.value)} className="mt-1" /></div>
        </div>
        <div><label className="text-xs font-medium text-muted-foreground">Descrizione</label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={2} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-medium text-muted-foreground">Range stipendio</label><Input value={salaryRange} onChange={(e) => setSalaryRange(e.target.value)} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Outlook</label>
            <select value={growthOutlook} onChange={(e) => setGrowthOutlook(e.target.value)} className="mt-1 w-full text-sm border rounded-md px-2 py-1.5 bg-background">
              <option value="declining">In calo</option><option value="stable">Stabile</option><option value="growing">In crescita</option>
            </select></div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={saving || !title.trim()}>
            {saving ? <Loader2 size={13} className="animate-spin mr-1" /> : <Save size={13} className="mr-1" />}
            {initial ? "Aggiorna" : "Crea"}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>Annulla</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Education Paths ──────────────────────────────────────────────────────────
interface EducationPath {
  id: number; path: string; type: string; duration: string; cost: string;
  steps: string[]; careerOutcomes: string[]; sectorFit: string[]; isActive: boolean;
}

function EducationForm({ initial, adminKey, onSaved, onCancel }: {
  initial?: EducationPath; adminKey: string; onSaved: () => void; onCancel: () => void;
}) {
  const [path, setPath] = useState(initial?.path ?? "");
  const [type, setType] = useState(initial?.type ?? "universitario");
  const [duration, setDuration] = useState(initial?.duration ?? "3 anni");
  const [cost, setCost] = useState(initial?.cost ?? "Gratuito");
  const [steps, setSteps] = useState<string[]>(initial?.steps ?? []);
  const [careerOutcomes, setCareerOutcomes] = useState<string[]>(initial?.careerOutcomes ?? []);
  const [sectorFit, setSectorFit] = useState<string[]>(initial?.sectorFit ?? []);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const url = initial ? `${BASE}api/admin/catalogs/education-paths/${initial.id}` : `${BASE}api/admin/catalogs/education-paths`;
      const method = initial ? "PUT" : "POST";
      await fetch(url, {
        method, headers: { "x-admin-key": adminKey, "Content-Type": "application/json" },
        body: JSON.stringify({ path, type, duration, cost, steps, careerOutcomes, sectorFit }),
      });
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <Card className="border-primary/30 border-2">
      <CardContent className="pt-4 space-y-3">
        <div><label className="text-xs font-medium text-muted-foreground">Nome percorso</label><Input value={path} onChange={(e) => setPath(e.target.value)} className="mt-1" /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs font-medium text-muted-foreground">Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full text-sm border rounded-md px-2 py-1.5 bg-background">
              <option value="universitario">Universitario</option><option value="professionale">Professionale</option>
              <option value="online">Online</option><option value="bootcamp">Bootcamp</option>
            </select></div>
          <div><label className="text-xs font-medium text-muted-foreground">Durata</label><Input value={duration} onChange={(e) => setDuration(e.target.value)} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Costo</label><Input value={cost} onChange={(e) => setCost(e.target.value)} className="mt-1" /></div>
        </div>
        <ArrayField label="Step" value={steps} onChange={setSteps} />
        <ArrayField label="Sbocchi" value={careerOutcomes} onChange={setCareerOutcomes} />
        <ArrayField label="Aree compatibili" value={sectorFit} onChange={setSectorFit} />
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={saving || !path.trim()}>
            {saving ? <Loader2 size={13} className="animate-spin mr-1" /> : <Save size={13} className="mr-1" />}
            {initial ? "Aggiorna" : "Crea"}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>Annulla</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Growth Articles ──────────────────────────────────────────────────────────
interface GrowthArticle {
  id: number; title: string; category: string; description: string;
  difficulty: string; status: string; readTimeMinutes: number;
}

function GrowthArticleForm({ initial, adminKey, onSaved, onCancel }: {
  initial?: GrowthArticle; adminKey: string; onSaved: () => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "generale");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? "base");
  const [status, setStatus] = useState(initial?.status ?? "published");
  const [readTime, setReadTime] = useState(String(initial?.readTimeMinutes ?? 3));
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const url = initial ? `${BASE}api/admin/catalogs/growth-articles/${initial.id}` : `${BASE}api/admin/catalogs/growth-articles`;
      const method = initial ? "PUT" : "POST";
      await fetch(url, {
        method, headers: { "x-admin-key": adminKey, "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, description, difficulty, status, readTimeMinutes: Number(readTime), content }),
      });
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <Card className="border-primary/30 border-2">
      <CardContent className="pt-4 space-y-3">
        <div><label className="text-xs font-medium text-muted-foreground">Titolo</label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs font-medium text-muted-foreground">Categoria</label><Input value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Difficoltà</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="mt-1 w-full text-sm border rounded-md px-2 py-1.5 bg-background">
              <option value="base">Base</option><option value="intermedio">Intermedio</option><option value="avanzato">Avanzato</option>
            </select></div>
          <div><label className="text-xs font-medium text-muted-foreground">Stato</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full text-sm border rounded-md px-2 py-1.5 bg-background">
              <option value="published">Pubblicato</option><option value="pending">In attesa</option><option value="rejected">Scartato</option>
            </select></div>
        </div>
        <div><label className="text-xs font-medium text-muted-foreground">Descrizione</label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={2} /></div>
        {!initial && <div><label className="text-xs font-medium text-muted-foreground">Contenuto (Markdown)</label><Textarea value={content} onChange={(e) => setContent(e.target.value)} className="mt-1 font-mono text-xs" rows={6} /></div>}
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={saving || !title.trim()}>
            {saving ? <Loader2 size={13} className="animate-spin mr-1" /> : <Save size={13} className="mr-1" />}
            {initial ? "Aggiorna" : "Crea"}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>Annulla</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Generic list row ─────────────────────────────────────────────────────────
function ListRow({ label, sub, active, onEdit, onDelete }: {
  label: string; sub?: string; active?: boolean;
  onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
      </div>
      {active !== undefined && (
        <Badge variant="outline" className={`text-xs shrink-0 ${active ? "text-emerald-600 border-emerald-200" : "text-muted-foreground"}`}>
          {active ? "Attivo" : "Inattivo"}
        </Badge>
      )}
      <div className="flex items-center gap-1 shrink-0">
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onEdit}><Edit3 size={13} /></Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600" onClick={onDelete}><Trash2 size={13} /></Button>
      </div>
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "sectors", label: "Aree", icon: <Briefcase size={14} /> },
  { id: "professions", label: "Professioni", icon: <Users size={14} /> },
  { id: "education-paths", label: "Percorsi", icon: <GraduationCap size={14} /> },
  { id: "growth-articles", label: "Articoli Crescita", icon: <BookOpen size={14} /> },
];

export default function AdminCataloghi() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("northstar_admin_key") ?? "");
  const [keyInput, setKeyInput] = useState("");
  const [tab, setTab] = useState<Tab>("sectors");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const sectors = useAdminFetch<Sector>("sectors", adminKey);
  const professions = useAdminFetch<Profession>("professions", adminKey);
  const educationPaths = useAdminFetch<EducationPath>("education-paths", adminKey);
  const growthArticles = useAdminFetch<GrowthArticle>("growth-articles", adminKey);

  const resources = { sectors, professions, "education-paths": educationPaths, "growth-articles": growthArticles };
  const current = resources[tab];

  async function deleteItem(url: string) {
    if (!confirm("Eliminare questo elemento?")) return;
    await fetch(url, { method: "DELETE", headers: { "x-admin-key": adminKey } });
    current.refresh();
  }

  if (!adminKey) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader><CardTitle className="text-center">Admin — NorthStar</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input type="password" placeholder="Chiave admin" value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { localStorage.setItem("northstar_admin_key", keyInput.trim()); setAdminKey(keyInput.trim()); }
              }} />
            <Button className="w-full" onClick={() => {
              localStorage.setItem("northstar_admin_key", keyInput.trim()); setAdminKey(keyInput.trim());
            }}>Accedi</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen size={22} className="text-primary" />
              Cataloghi
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gestisci settori, professioni, percorsi e articoli</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={current.refresh} disabled={current.loading}>
              {current.loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </Button>
            <Button size="sm" onClick={() => { setCreating(true); setEditingId(null); }}>
              <Plus size={13} className="mr-1" /> Nuovo
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setCreating(false); setEditingId(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-1 justify-center ${
                tab === t.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon} {t.label}
              <span className="ml-1 text-xs font-normal opacity-60">
                ({resources[t.id].data.length})
              </span>
            </button>
          ))}
        </div>

        {/* Create form */}
        {creating && (
          <div>
            {tab === "sectors" && <SectorForm adminKey={adminKey} onSaved={() => { setCreating(false); current.refresh(); }} onCancel={() => setCreating(false)} />}
            {tab === "professions" && <ProfessionForm adminKey={adminKey} onSaved={() => { setCreating(false); current.refresh(); }} onCancel={() => setCreating(false)} />}
            {tab === "education-paths" && <EducationForm adminKey={adminKey} onSaved={() => { setCreating(false); current.refresh(); }} onCancel={() => setCreating(false)} />}
            {tab === "growth-articles" && <GrowthArticleForm adminKey={adminKey} onSaved={() => { setCreating(false); current.refresh(); }} onCancel={() => setCreating(false)} />}
          </div>
        )}

        {/* List */}
        <Card>
          <CardContent className="pt-4">
            {current.loading && current.data.length === 0 && (
              <div className="space-y-2">{[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
            )}
            {!current.loading && current.data.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">Nessun elemento. Creane uno con il pulsante "Nuovo".</p>
            )}
            <div className="space-y-1">
              {tab === "sectors" && (sectors.data as Sector[]).map((s) => (
                editingId === s.id
                  ? <SectorForm key={s.id} initial={s} adminKey={adminKey} onSaved={() => { setEditingId(null); current.refresh(); }} onCancel={() => setEditingId(null)} />
                  : <ListRow key={s.id} label={s.name} sub={`${s.trend} · rischio ${s.automationRisk}`}
                      onEdit={() => setEditingId(s.id)} onDelete={() => deleteItem(`${BASE}api/admin/catalogs/sectors/${s.id}`)} />
              ))}
              {tab === "professions" && (professions.data as Profession[]).map((p) => (
                editingId === p.id
                  ? <ProfessionForm key={p.id} initial={p} adminKey={adminKey} onSaved={() => { setEditingId(null); current.refresh(); }} onCancel={() => setEditingId(null)} />
                  : <ListRow key={p.id} label={p.title} sub={`${p.sector} · ${p.salaryRange}`} active={p.isActive}
                      onEdit={() => setEditingId(p.id)} onDelete={() => deleteItem(`${BASE}api/admin/catalogs/professions/${p.id}`)} />
              ))}
              {tab === "education-paths" && (educationPaths.data as EducationPath[]).map((e) => (
                editingId === e.id
                  ? <EducationForm key={e.id} initial={e} adminKey={adminKey} onSaved={() => { setEditingId(null); current.refresh(); }} onCancel={() => setEditingId(null)} />
                  : <ListRow key={e.id} label={e.path} sub={`${e.type} · ${e.duration} · ${e.cost}`} active={e.isActive}
                      onEdit={() => setEditingId(e.id)} onDelete={() => deleteItem(`${BASE}api/admin/catalogs/education-paths/${e.id}`)} />
              ))}
              {tab === "growth-articles" && (growthArticles.data as GrowthArticle[]).map((a) => (
                editingId === a.id
                  ? <GrowthArticleForm key={a.id} initial={a} adminKey={adminKey} onSaved={() => { setEditingId(null); current.refresh(); }} onCancel={() => setEditingId(null)} />
                  : <ListRow key={a.id} label={a.title} sub={`${a.category} · ${a.difficulty} · ${a.status}`}
                      onEdit={() => setEditingId(a.id)} onDelete={() => deleteItem(`${BASE}api/admin/catalogs/growth-articles/${a.id}`)} />
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 text-xs text-muted-foreground pt-2">
          <a href="/admin" className="hover:underline">← Admin Home</a>
          <span>·</span>
          <a href="/admin/crescita" className="hover:underline">Coda Crescita</a>
          <span>·</span>
          <a href="/admin/agenti" className="hover:underline">Agent Health</a>
        </div>
      </div>
    </div>
  );
}
