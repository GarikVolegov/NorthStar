import { AdminAuthGate } from "@/components/AdminAuthGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { usePageModule } from "@/hooks/usePageModule";
import {
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  ChevronRight,
  FlaskConical,
  MessageSquare,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

function NavCard({
  href,
  icon,
  title,
  description,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
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
                {badge && (
                  <Badge className="border-warning-muted bg-warning-surface px-1.5 py-0 text-xs text-warning">
                    {badge}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {description}
              </p>
            </div>
            <ChevronRight
              size={14}
              className="text-muted-foreground shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform"
            />
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

function SectionHeader({
  title,
  subtitle,
  color,
}: {
  title: string;
  subtitle: string;
  color: string;
}) {
  return (
    <div className={`rounded-xl p-4 mb-3 ${color}`}>
      <h2 className="font-bold text-base">{title}</h2>
      <p className="text-xs opacity-80 mt-0.5">{subtitle}</p>
    </div>
  );
}

export default function AdminHome() {
  const { logout } = useAdminAuth();
  usePageModule({ pageId: "admin-home" });

  return (
    <AdminAuthGate
      title="Admin Console"
      description="Panoramica completa - Discovery · Execution · Monitoraggio"
    >
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
                Panoramica completa - Discovery · Execution · Monitoraggio
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-danger"
              onClick={logout}
            >
              Disconnetti
            </Button>
          </div>

          {/* Discovery Section */}
          <div>
            <SectionHeader
              title="Discovery"
              subtitle="Strumenti per esplorare e mappare il mondo del lavoro - test, settori, ruoli, percorsi"
              color="bg-info-surface border border-info-muted text-info"
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
                href="/admin/rag"
                icon={<Brain size={16} />}
                title="RAG & Intelligence"
                description="Gestione knowledge base, ingestione fonti, segnali deboli e job market"
                badge="Step 6-8"
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
              subtitle="Strumenti operativi - obiettivi, calendario, crescita personale, coaching"
              color="bg-warning-surface border border-warning-muted text-warning"
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
              color="bg-success-surface border border-success-muted text-success"
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
                  { href: "/calendario", label: "Calendario" },
                  { href: "/wiki/1", label: "Wendy AI" },
                ].map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminAuthGate>
  );
}
