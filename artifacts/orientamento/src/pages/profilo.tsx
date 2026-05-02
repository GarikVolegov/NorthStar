import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  User, Star, Mail, Calendar, CheckCircle2, Clock,
  ChevronRight, Loader2, KeyRound, BarChart3, Sparkles, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL || "/";

const SPIRIT_META: Record<string, { emoji: string; label: string }> = {
  shen: { emoji: "✨", label: "Shen" },
  hun: { emoji: "🌙", label: "Hun" },
  po: { emoji: "⚡", label: "Po" },
  yi: { emoji: "🔮", label: "Yi" },
  zhi: { emoji: "🔥", label: "Zhi" },
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

interface ProfileData {
  id: number;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  testSessions: SessionData[];
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

function SessionCard({ session, index }: { session: SessionData; index: number }) {
  const spirit = session.dominantSpirit ? SPIRIT_META[session.dominantSpirit] : null;
  const profile = (session.primaryTypes ?? []).join(" + ");

  return (
    <Link href={`/risultati/${session.id}`}>
      <div
        className={cn(
          "group flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl border bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer",
          index === 0 && "border-primary/20 bg-primary/5"
        )}
      >
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

function ChangePasswordForm({ userId }: { userId: number }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError("Le nuove password non coincidono");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);
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
        setOldPassword("");
        setNewPassword("");
        setConfirm("");
      }
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="old-password">Password attuale</Label>
        <Input
          id="old-password"
          type="password"
          placeholder="••••••••"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-password">Nuova password</Label>
        <Input
          id="new-password"
          type="password"
          placeholder="Min. 6 caratteri"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">Conferma nuova password</Label>
        <Input
          id="confirm-password"
          type="password"
          placeholder="Ripeti la nuova password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          className={confirm && newPassword !== confirm ? "border-destructive" : ""}
        />
        {confirm && newPassword !== confirm && (
          <p className="text-xs text-destructive">Le password non coincidono</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
      {success && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Password aggiornata con successo.
        </div>
      )}

      <Button
        type="submit"
        className="rounded-full"
        disabled={loading || (!!confirm && newPassword !== confirm)}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Aggiorna password
      </Button>
    </form>
  );
}

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
    <div className="container mx-auto px-4 py-10 max-w-4xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Il mio profilo</h1>
          <p className="text-muted-foreground mt-1">Gestisci il tuo account e consulta la tua storia</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-full w-fit" onClick={logout}>
          Esci dall'account
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Left column: account info + change password */}
        <div className="md:col-span-1 space-y-5">

          {/* Account card */}
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

          {/* Change password card */}
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
        </div>

        {/* Right column: test history */}
        <div className="md:col-span-2">
          <Card className="rounded-2xl">
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
    </div>
  );
}
