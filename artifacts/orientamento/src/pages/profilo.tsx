import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  User, Star, Mail, Calendar, CheckCircle2, Clock,
  ChevronRight, Loader2, KeyRound, BarChart3, Sparkles, ShieldCheck,
  TrendingUp, DollarSign, Activity, Settings2, ArrowRight, Layers,
  Bookmark, ExternalLink, Newspaper, X, Heart,
  Target, Plus, Check,
} from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL || "/";

const SPIRIT_META: Record<string, { emoji: string; label: string }> = {
  shen: { emoji: "✨", label: "Presenza" },
  hun:  { emoji: "🌙", label: "Visione" },
  po:   { emoji: "⚡", label: "Istinto" },
  yi:   { emoji: "🔮", label: "Focus" },
  zhi:  { emoji: "🔥", label: "Tenacia" },
};

const TREND_LABEL: Record<string, { label: string; color: string }> = {
  booming:  { label: "In forte crescita", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  growing:  { label: "In crescita",       color: "text-blue-600 bg-blue-50 border-blue-200" },
  stable:   { label: "Stabile",           color: "text-amber-600 bg-amber-50 border-amber-200" },
  declining:{ label: "In calo",           color: "text-rose-600 bg-rose-50 border-rose-200" },
};

const RISK_LABEL: Record<string, { label: string; color: string }> = {
  low:    { label: "Basso",  color: "text-emerald-700 bg-emerald-50" },
  medium: { label: "Medio",  color: "text-amber-700 bg-amber-50" },
  high:   { label: "Alto",   color: "text-rose-700 bg-rose-50" },
};

interface SessionData {
  id: number;
  createdAt: string;
  primaryTypes: string[];
  profileSummary: string;
  dominantSpirit: string | null;
  spiritScores: Record<string, number> | null;
  confirmedSectorId: number | null;
  confirmedSector: { id: number; name: string; icon: string; description: string } | null;
  topRecommendation: { sectorId: number; sectorName: string; matchScore: number } | null;
}

interface ExploredSector {
  sectorId: number;
  bestMatchScore: number;
  confirmed: boolean;
  name: string;
  icon: string;
  description: string;
  avgSalaryMin: number;
  avgSalaryMax: number;
  growthRate: number;
  automationRisk: "low" | "medium" | "high";
  scalability: "low" | "medium" | "high";
  trend: "declining" | "stable" | "growing" | "booming";
  timeToAutonomy: string;
  riasecTypes: string[];
  skills: string[];
  advantages: string[];
}

interface ProfileData {
  id: number;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  testSessions: SessionData[];
  exploredSectors: ExploredSector[];
}

function useProfile(userId: number) {
  return useQuery<ProfileData>({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/profile/${userId}`);
      if (!res.ok) throw new Error("Errore caricamento profilo");
      return res.json();
    },
    enabled: !!userId,
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric", month: "long", year: "numeric",
  });
}

// ── Session card ─────────────────────────────────────────────────────
function SessionCard({ session, index }: { session: SessionData; index: number }) {
  const spirit = session.dominantSpirit ? SPIRIT_META[session.dominantSpirit] : null;
  const profile = (session.primaryTypes ?? []).join(" + ");

  return (
    <Link href={`/risultati/${session.id}`}>
      <div className={cn(
        "group flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl border bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer",
        index === 0 && "border-primary/20 bg-primary/5"
      )}>
        <div className="flex items-center gap-4 flex-1">
          <div className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold font-serif",
            index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
          )}>
            {index === 0 ? <Star className="w-5 h-5 fill-current" /> : String(index + 1)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-foreground capitalize">{profile || "—"}</span>
              {spirit && (
                <span className="text-xs bg-background border rounded-full px-2 py-0.5">
                  {spirit.emoji} {spirit.label}
                </span>
              )}
              {index === 0 && (
                <Badge variant="secondary" className="text-xs rounded-full">Più recente</Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {formatDate(session.createdAt)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:ml-auto">
          {session.confirmedSector ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-3 py-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs font-medium">{session.confirmedSector.icon} {session.confirmedSector.name}</span>
            </div>
          ) : session.topRecommendation ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground border rounded-xl px-3 py-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              {session.topRecommendation.sectorName} · {session.topRecommendation.matchScore}%
            </div>
          ) : null}
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>
      </div>
    </Link>
  );
}

// ── Explored sector card ─────────────────────────────────────────────
function ExploredSectorCard({ sector }: { sector: ExploredSector }) {
  const trend = TREND_LABEL[sector.trend];
  const risk = RISK_LABEL[sector.automationRisk];

  return (
    <div className={cn(
      "flex flex-col rounded-2xl border bg-card overflow-hidden hover:shadow-lg transition-all duration-300",
      sector.confirmed && "border-primary/30 ring-1 ring-primary/10"
    )}>
      {sector.confirmed && (
        <div className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-4 py-2">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Direzione confermata
        </div>
      )}

      <div className="p-5 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{sector.icon}</span>
            <div>
              <h3 className="font-serif font-bold text-foreground leading-tight">{sector.name}</h3>
              <div className={cn("mt-1 inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2.5 py-0.5", trend?.color)}>
                <TrendingUp className="w-3 h-3" />
                {trend?.label}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-2xl font-bold text-primary">{sector.bestMatchScore}%</span>
            <p className="text-xs text-muted-foreground">match</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2">
          {sector.description}
        </p>

        {/* Career metrics */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-muted/50 rounded-xl p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <DollarSign className="w-3 h-3" /> RAL media
            </div>
            <p className="text-sm font-semibold">
              €{Math.round(sector.avgSalaryMin / 1000)}k – €{Math.round(sector.avgSalaryMax / 1000)}k
            </p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <TrendingUp className="w-3 h-3" /> Crescita
            </div>
            <p className="text-sm font-semibold text-emerald-600">+{sector.growthRate}% / anno</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Settings2 className="w-3 h-3" /> Rischio auto.
            </div>
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", risk?.color)}>
              {risk?.label}
            </span>
          </div>
          <div className="bg-muted/50 rounded-xl p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Activity className="w-3 h-3" /> Autonomia
            </div>
            <p className="text-sm font-semibold">{sector.timeToAutonomy}</p>
          </div>
        </div>

        {/* Skills */}
        {sector.skills.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Competenze chiave</p>
            <div className="flex flex-wrap gap-1.5">
              {sector.skills.map((skill) => (
                <span key={skill} className="text-xs bg-primary/8 text-primary border border-primary/15 rounded-full px-2.5 py-0.5 font-medium">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Advantages */}
        {sector.advantages.length > 0 && (
          <div className="mb-4 space-y-1.5">
            {sector.advantages.map((adv) => (
              <div key={adv} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{adv}</span>
              </div>
            ))}
          </div>
        )}

        {/* RIASEC types */}
        <div className="flex flex-wrap gap-1 mb-5 mt-auto">
          {sector.riasecTypes.map((t) => (
            <Badge key={t} variant="outline" className="text-xs rounded-full font-mono">{t}</Badge>
          ))}
        </div>

        <Button asChild variant="outline" className="w-full rounded-full" size="sm">
          <Link href={`/settore/${sector.sectorId}`}>
            Approfondisci il settore <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ── Mini objectives ───────────────────────────────────────────────────
const FREE_LIMIT = 5;

interface Objective {
  id: number;
  userId: number;
  text: string;
  completed: boolean;
  createdAt: string;
}

function MiniObjectives({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const { data: objectives = [], isLoading } = useQuery<Objective[]>({
    queryKey: ["objectives", userId],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/objectives/${userId}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });

  const addMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(`${BASE}api/objectives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, text }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["objectives", userId] });
      setInput("");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: number; completed: boolean }) => {
      const res = await fetch(`${BASE}api/objectives/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["objectives", userId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${BASE}api/objectives/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["objectives", userId] }),
  });

  const active = objectives.filter((o) => !o.completed);
  const completed = objectives.filter((o) => o.completed);
  const atLimit = active.length >= FREE_LIMIT;

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || atLimit) return;
    addMutation.mutate(input.trim());
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" /> Il mio prossimo passo
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Annotati piccoli obiettivi concreti per restare in movimento.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">

        {/* Active objectives */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
          </div>
        ) : active.length === 0 && completed.length === 0 ? (
          <div className="text-center py-6 px-3">
            <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center mx-auto mb-3">
              <Target className="w-5 h-5 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nessun obiettivo ancora.<br />
              Aggiungi il tuo primo piccolo passo.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {active.map((obj) => (
              <li key={obj.id} className="flex items-start gap-2.5 group">
                <button
                  onClick={() => toggleMutation.mutate({ id: obj.id, completed: true })}
                  disabled={toggleMutation.isPending}
                  className="mt-0.5 w-5 h-5 rounded-full border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors shrink-0 flex items-center justify-center"
                  title="Segna come completato"
                />
                <p className="flex-1 text-sm text-foreground leading-snug pt-0.5">{obj.text}</p>
                <button
                  onClick={() => deleteMutation.mutate(obj.id)}
                  disabled={deleteMutation.isPending}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-muted-foreground hover:text-destructive transition-all"
                  title="Elimina"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Completed section */}
        {completed.length > 0 && (
          <div>
            <button
              onClick={() => setShowCompleted((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 mt-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              {completed.length} completat{completed.length === 1 ? "o" : "i"}
              <span className="opacity-60">{showCompleted ? "▲" : "▼"}</span>
            </button>
            {showCompleted && (
              <ul className="space-y-1.5 mt-2">
                {completed.map((obj) => (
                  <li key={obj.id} className="flex items-start gap-2.5 group">
                    <button
                      onClick={() => toggleMutation.mutate({ id: obj.id, completed: false })}
                      disabled={toggleMutation.isPending}
                      className="mt-0.5 w-5 h-5 rounded-full bg-emerald-100 border-2 border-emerald-400 shrink-0 flex items-center justify-center hover:bg-emerald-200 transition-colors"
                      title="Segna come da fare"
                    >
                      <Check className="w-3 h-3 text-emerald-600" />
                    </button>
                    <p className="flex-1 text-sm text-muted-foreground line-through leading-snug pt-0.5">{obj.text}</p>
                    <button
                      onClick={() => deleteMutation.mutate(obj.id)}
                      disabled={deleteMutation.isPending}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-muted-foreground hover:text-destructive transition-all"
                      title="Elimina"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Add new objective */}
        <form onSubmit={handleAdd} className="flex gap-2 pt-1">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={atLimit ? `Limite ${FREE_LIMIT} obiettivi (Free)` : "Aggiungi un obiettivo…"}
            disabled={atLimit}
            maxLength={120}
            className="rounded-xl text-sm h-9"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || atLimit || addMutation.isPending}
            className="rounded-xl h-9 w-9 p-0 shrink-0"
            title="Aggiungi"
          >
            {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </form>

        {atLimit && (
          <p className="text-xs text-muted-foreground text-center pt-1">
            Hai raggiunto il limite Free.{" "}
            <Link href="/premium" className="text-primary hover:underline font-medium">
              Upgrade per obiettivi illimitati
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Change password form ─────────────────────────────────────────────
function ChangePasswordForm({ userId }: { userId: number }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) { setError("Le nuove password non coincidono"); return; }
    setLoading(true); setError(null); setSuccess(false);
    try {
      const res = await fetch(`${BASE}api/profile/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Errore durante l'aggiornamento");
      } else {
        setSuccess(true);
        setOldPassword(""); setNewPassword(""); setConfirm("");
      }
    } catch { setError("Errore di rete. Riprova."); }
    finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="old-password">Password attuale</Label>
        <Input id="old-password" type="password" placeholder="••••••••"
          value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required autoComplete="current-password" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-password">Nuova password</Label>
        <Input id="new-password" type="password" placeholder="Min. 6 caratteri"
          value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">Conferma nuova password</Label>
        <Input id="confirm-password" type="password" placeholder="Ripeti la nuova password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password"
          className={confirm && newPassword !== confirm ? "border-destructive" : ""} />
        {confirm && newPassword !== confirm && <p className="text-xs text-destructive">Le password non coincidono</p>}
      </div>
      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
      {success && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Password aggiornata con successo.
        </div>
      )}
      <Button type="submit" className="rounded-full" disabled={loading || (!!confirm && newPassword !== confirm)}>
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Aggiorna password
      </Button>
    </form>
  );
}

// ── Saved items section ───────────────────────────────────────────────
function SavedItems({ userId }: { userId: number }) {
  const { favorites, removeFavorite, isLoading } = useFavorites();
  const savedSectors = favorites.filter((f) => f.type === "sector");
  const savedArticles = favorites.filter((f) => f.type === "news");

  if (favorites.length === 0) return null;

  return (
    <Card className="rounded-2xl mt-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-primary" /> Elementi salvati
          </CardTitle>
          <span className="text-sm text-muted-foreground">{favorites.length} salvati</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Settori e articoli che hai messo da parte.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Saved sectors */}
        {savedSectors.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
              <Heart className="w-3 h-3" /> Settori preferiti
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedSectors.map((fav) => (
                <div key={fav.id} className="flex items-center gap-3 bg-muted/40 rounded-xl p-3 border border-border/50 group">
                  <span className="text-2xl shrink-0">{fav.sector?.icon ?? "💼"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{fav.sector?.name ?? "Settore"}</p>
                    {fav.sector && (
                      <p className="text-xs text-muted-foreground">
                        €{Math.round(fav.sector.avgSalaryMin / 1000)}k–€{Math.round(fav.sector.avgSalaryMax / 1000)}k · +{fav.sector.growthRate}%
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link href={`/settore/${fav.sectorId}`}>
                      <button className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors" title="Vedi settore">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </Link>
                    <button
                      onClick={() => removeFavorite(fav.id)}
                      disabled={isLoading}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                      title="Rimuovi"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Saved articles */}
        {savedArticles.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
              <Newspaper className="w-3 h-3" /> Articoli salvati
            </p>
            <div className="space-y-2">
              {savedArticles.map((fav) => (
                <div key={fav.id} className="flex items-start gap-3 bg-muted/40 rounded-xl p-3 border border-border/50 group">
                  {fav.articleImage && (
                    <img
                      src={fav.articleImage}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover shrink-0 hidden sm:block"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground line-clamp-2 leading-snug">{fav.articleTitle}</p>
                    {fav.articleSource && (
                      <p className="text-xs text-muted-foreground mt-0.5">{fav.articleSource}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    {fav.articleUrl && (
                      <a
                        href={fav.articleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                        title="Apri articolo"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => removeFavorite(fav.id)}
                      disabled={isLoading}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                      title="Rimuovi"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ────────────────────────────────────────────────────────
export default function Profilo() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) {
    return (
      <div className="container max-w-lg mx-auto px-4 py-24 text-center">
        <User className="w-14 h-14 mx-auto text-muted-foreground mb-4 opacity-40" />
        <h1 className="text-2xl font-serif font-bold mb-3">Accesso richiesto</h1>
        <p className="text-muted-foreground mb-6">Accedi al tuo account per vedere il profilo.</p>
        <Button onClick={() => setLocation("/")} className="rounded-full">Torna alla home</Button>
      </div>
    );
  }

  const { data: profile, isLoading } = useProfile(user.id);

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Il mio profilo</h1>
          <p className="text-muted-foreground mt-1">Gestisci il tuo account e consulta la tua storia</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-full w-fit" onClick={logout}>
          Esci dall'account
        </Button>
      </div>

      {/* Top row: account info + test history */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">

        {/* Account + change password */}
        <div className="md:col-span-1 space-y-5">
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <span className="text-2xl font-serif font-bold text-primary">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Nome</p>
                <p className="font-semibold text-foreground">{user.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Email</p>
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-sm truncate">{user.email}</p>
                </div>
              </div>
              {profile && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Membro dal</p>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-sm">{formatDate(profile.createdAt)}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1.5 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs text-emerald-700 font-medium">Email verificata</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" /> Cambia password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm userId={user.id} />
            </CardContent>
          </Card>

          <MiniObjectives userId={user.id} />
        </div>

        {/* Test history */}
        <div className="md:col-span-2">
          <Card className="rounded-2xl h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Cronologia test
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
                </div>
              ) : !profile || profile.testSessions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="w-7 h-7 text-muted-foreground opacity-50" />
                  </div>
                  <p className="font-medium text-foreground mb-1">Nessun test completato</p>
                  <p className="text-sm text-muted-foreground mb-5">
                    Fai il test per scoprire il tuo profilo e i settori più adatti a te.
                  </p>
                  <Button asChild className="rounded-full">
                    <Link href="/test">Inizia il Test Gratuito</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {profile.testSessions.map((session, index) => (
                    <SessionCard key={session.id} session={session} index={index} />
                  ))}
                  <Separator className="my-4" />
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {profile.testSessions.length} test completat{profile.testSessions.length === 1 ? "o" : "i"}
                    </p>
                    <Button asChild variant="outline" size="sm" className="rounded-full">
                      <Link href="/test">Fai un nuovo test</Link>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Explored sectors — full width */}
      {(isLoading || (profile && profile.exploredSectors.length > 0)) && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Settori esplorati
              </CardTitle>
              {profile && (
                <span className="text-sm text-muted-foreground">
                  {profile.exploredSectors.length} settori unici
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Tutti i settori emersi dai tuoi test, con dati di carriera aggiornati.
              {profile?.exploredSectors.some((s) => s.confirmed) && (
                <> La tua <span className="text-primary font-medium">direzione confermata</span> è in evidenza.</>
              )}
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-80 w-full rounded-2xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {profile!.exploredSectors.map((sector) => (
                  <ExploredSectorCard key={sector.sectorId} sector={sector} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Saved items — sectors + articles */}
      <SavedItems userId={user.id} />

    </div>
  );
}
