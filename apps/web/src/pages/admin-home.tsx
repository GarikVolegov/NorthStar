import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Compass, Zap, BarChart3, Bot, BookOpen, Sparkles, Settings,
  Users, Calendar, TrendingUp, Brain, GraduationCap, FileText,
  Target, MessageSquare, ChevronRight, Shield, FlaskConical,
} from "lucide-react";

function NavCard({ href, icon, title, description, badge }: {
  href: string; icon: React.ReactNode; title: string; description: string; badge?: string;
}) {
  return (
    <a href={href} className="block group">
      <Card className="h-full border hover:border-primary/40 hover:shadow-sm transition-all duration-200">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary/20 transition-colors">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{title}</span>
                {badge && <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 px-1.5 py-0">{badge}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
            </div>
            <ChevronRight size={14} className="text-muted-foreground shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

function SectionHeader({ title, subtitle, color }: { title: string; subtitle: string; color: string }) {
  return (
    <div className={`rounded-xl p-4 mb-3 ${color}`}>
      <h2 className="font-bold text-base">{title}</h2>
      <p className="text-xs opacity-80 mt-0.5">{subtitle}</p>
    </div>
  );
}

export default function AdminHome() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("northstar_admin_key") ?? "");
  const [keyInput, setKeyInput] = useState("");

  if (!adminKey) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <div className="flex items-center justify-center mb-2">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Shield size={24} className="text-primary" />
              </div>
            </div>
            <CardTitle className="text-center">Admin — NorthStar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="password"
              placeholder="Chiave admin"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  localStorage.setItem("northstar_admin_key", keyInput.trim());
                  setAdminKey(keyInput.trim());
                }
              }}
            />
            <Button className="w-full" onClick={() => {
              localStorage.setItem("northstar_admin_key", keyInput.trim());
              setAdminKey(keyInput.trim());
            }}>
              Accedi al pannello admin
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield size={22} className="text-primary" />
              NorthStar Admin Console
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Panoramica completa — Discovery · Execution · Monitoraggio
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs text-red-500"
            onClick={() => {
              localStorage.removeItem("northstar_admin_key");
              setAdminKey("");
            }}
          >
            Disconnetti
          </Button>
        </div>

        {/* Discovery Section */}
        <div>
          <SectionHeader
            title="Discovery"
            subtitle="Strumenti per esplorare e mappare il mondo del lavoro — test, settori, ruoli, percorsi"
            color="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <NavCard
              href="/admin/cataloghi"
              icon={<BookOpen size={16} />}
              title="Cataloghi"
              description="CRUD settori, professioni, percorsi formativi e articoli crescita"
              badge="P3"
            />
            <NavCard
              href="/admin/review"
              icon={<FlaskConical size={16} />}
              title="Review Contenuti"
              description="Revisiona e valida i contenuti generati dall'AI prima della pubblicazione"
            />
            <NavCard
              href="/admin/messaggi"
              icon={<MessageSquare size={16} />}
              title="Messaggi"
              description="Gestisci i messaggi di contatto degli utenti e le richieste di supporto"
            />
          </div>
        </div>

        {/* Execution Section */}
        <div>
          <SectionHeader
            title="Execution"
            subtitle="Strumenti operativi — obiettivi, calendario, crescita personale, coaching"
            color="bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <NavCard
              href="/admin/crescita"
              icon={<Sparkles size={16} />}
              title="Coda Crescita"
              description="Approva, modifica o scarta articoli di crescita generati da Tavily + AI"
              badge="P9"
            />
            <NavCard
              href="/admin/agenti"
              icon={<Bot size={16} />}
              title="Agent Health"
              description="Success rate, latenza e ultimi errori per ogni agente AI del sistema"
              badge="P4"
            />
            <NavCard
              href="/admin/prompts"
              icon={<Brain size={16} />}
              title="Prompt AI"
              description="Modifica i prompt degli agenti AI direttamente dal pannello admin"
            />
          </div>
        </div>

        {/* Monitoring Section */}
        <div>
          <SectionHeader
            title="Monitoraggio & Configurazione"
            subtitle="Salute del sistema, metriche business, integrazioni e setup wizard"
            color="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <NavCard
              href="/admin/metriche"
              icon={<BarChart3 size={16} />}
              title="Metriche Business"
              description="Utenti, test completati, settori più popolari, conversioni premium"
            />
            <NavCard
              href="/admin/status"
              icon={<Settings size={16} />}
              title="Status & Setup Wizard"
              description="Stato servizi (DB, AI, OpenAI), env vars e guide per ogni integrazione"
              badge="P5"
            />
            <NavCard
              href="/admin/affiliazione"
              icon={<Users size={16} />}
              title="Partner"
              description="Gestisci le richieste di affiliazione di scuole, università e agenzie"
            />
          </div>
        </div>

        {/* Quick stats summary via fetch */}
        <Card className="border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
              <TrendingUp size={14} />
              Link rapidi
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { href: "/", label: "Home pubblica" },
                { href: "/test", label: "Test RIASEC" },
                { href: "/profilo", label: "Profilo utente" },
                { href: "/crescita", label: "Modulo crescita" },
                { href: "/calendar", label: "Calendario" },
                { href: "/wiki/1", label: "Wendy AI" },
              ].map((l) => (
                <a key={l.href} href={l.href} className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors">
                  {l.label}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
