import { useEffect } from "react";
import { Link } from "wouter";
import { SectorIcon } from "@/lib/sector-icon";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Map, Home, FlaskConical, Newspaper, Star, User,
  BookOpen, GitBranch, Network, Globe, Shield, FileText,
  Info, ExternalLink, ArrowRight, ChevronRight,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";

interface Sector { id: number; name: string; icon: string; }

function useSectors() {
  return useQuery<Sector[]>({
    queryKey: ["sectors-list"],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/sectors`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 300_000,
  });
}

interface SitemapGroup {
  title: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  items: { label: string; href: string; desc?: string; badge?: string; iconName?: string }[];
}

const STATIC_GROUPS: SitemapGroup[] = [
  {
    title: "Principale",
    icon: Home,
    color: "#6366f1",
    bg: "#eef2ff",
    items: [
      { label: "Home",            href: "/",         desc: "La bussola per il tuo futuro" },
      { label: "Il Test",         href: "/test",     desc: "Test RIASEC + Cinque Spiriti (17 domande)" },
      { label: "News",            href: "/news",     desc: "Articoli aggiornati per settore" },
      { label: "Premium",         href: "/premium",  desc: "Piani e funzionalità avanzate" },
      { label: "Il mio profilo",  href: "/profilo",  desc: "Account, obiettivi e storico test" },
    ],
  },
  {
    title: "Esplora settori",
    icon: Globe,
    color: "#f59e0b",
    bg: "#fffbeb",
    items: [
      { label: "Tutti i settori",    href: "/settori",   desc: "Griglia dei 21 settori con filtri RIASEC e AI" },
      { label: "Confronta settori",  href: "/confronta", desc: "Comparatore fianco a fianco con URL condivisibile" },
    ],
  },
  {
    title: "Prodotto e brand",
    icon: Info,
    color: "#10b981",
    bg: "#ecfdf5",
    items: [
      { label: "Chi siamo",            href: "/chi-siamo",           desc: "Missione, metodo e valori di NorthStar" },
      { label: "Come funziona",        href: "/come-funziona",       desc: "RIASEC, Cinque Spiriti, FAQ e privacy" },
      { label: "Contatti",             href: "/contatti",            desc: "Scrivi al team NorthStar" },
      { label: "Mappa del sito",       href: "/sitemap",             desc: "Panoramica di tutte le pagine" },
      { label: "Privacy Policy",       href: "/privacy-policy",      desc: "Trattamento dei dati personali (GDPR)" },
      { label: "Termini di servizio",  href: "/termini-di-servizio", desc: "Condizioni d'uso della piattaforma" },
    ],
  },
];

export default function Sitemap() {
  const { data: sectors = [], isLoading } = useSectors();

  useEffect(() => {
    document.title = "Mappa del sito — NorthStar";
    const meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (meta) meta.content = "Mappa completa del sito NorthStar: tutte le pagine, i settori professionali e le risorse disponibili.";
  }, []);

  const sectorGroups: SitemapGroup[] = sectors.length > 0 ? [
    {
      title: "Settori professionali",
      icon: Globe,
      color: "#f59e0b",
      bg: "#fffbeb",
      items: sectors.map((s) => ({
        label: s.name,
        iconName: s.icon,
        href: `/settore/${s.id}`,
        desc: "Panoramica, dati e match",
      })),
    },
    {
      title: "Wiki per settore",
      icon: BookOpen,
      color: "#8b5cf6",
      bg: "#f5f3ff",
      items: sectors.map((s) => ({
        label: s.name,
        iconName: s.icon,
        href: `/wiki/${s.id}`,
        desc: "Contenuti AI approfonditi",
        badge: "Premium",
      })),
    },
    {
      title: "Roadmap di carriera",
      icon: GitBranch,
      color: "#3b82f6",
      bg: "#eff6ff",
      items: sectors.map((s) => ({
        label: s.name,
        iconName: s.icon,
        href: `/roadmap/${s.id}`,
        desc: "Percorso step-by-step",
        badge: "Premium",
      })),
    },
    {
      title: "Grafo della conoscenza",
      icon: Network,
      color: "#ec4899",
      bg: "#fdf2f8",
      items: sectors.map((s) => ({
        label: s.name,
        iconName: s.icon,
        href: `/grafo/${s.id}`,
        desc: "Visualizzazione AI interattiva",
        badge: "Premium",
      })),
    },
  ] : [];

  const allGroups = [...STATIC_GROUPS, ...sectorGroups];

  const totalPages = STATIC_GROUPS.reduce((s, g) => s + g.items.length, 0)
    + sectors.length * 4;

  return (
    <div className="min-h-screen">

      {/* Header */}
      <section className="border-b bg-gradient-to-b from-muted/40 to-background py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-5">
            <Map className="w-4 h-4" />
            Navigazione completa
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
            Mappa del sito
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-6">
            Tutte le pagine di NorthStar in un unico posto. Trovi sezioni, settori professionali, risorse premium e pagine istituzionali.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border rounded-xl px-3 py-2">
              <Globe className="w-4 h-4 text-primary" />
              {isLoading ? "…" : `${totalPages} pagine totali`}
            </div>
            <a
              href={`${BASE}api/sitemap.xml`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Scarica sitemap.xml
            </a>
          </div>
        </div>
      </section>

      {/* Groups */}
      <div className="container mx-auto px-4 max-w-6xl py-14 space-y-12">

        {/* Quick nav */}
        <div className="flex flex-wrap gap-2">
          {allGroups.map((g) => (
            <a
              key={g.title}
              href={`#${g.title.toLowerCase().replace(/\s+/g, "-")}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-card text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
            >
              <g.icon className="w-3 h-3" style={{ color: g.color }} />
              {g.title}
            </a>
          ))}
        </div>

        {allGroups.map((group) => (
          <section
            key={group.title}
            id={group.title.toLowerCase().replace(/\s+/g, "-")}
            className="scroll-mt-24"
          >
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: group.bg }}
              >
                <group.icon className="w-4.5 h-4.5" style={{ color: group.color }} />
              </div>
              <div>
                <h2 className="text-lg font-serif font-bold text-foreground">{group.title}</h2>
                <p className="text-xs text-muted-foreground">{group.items.length} pagine</p>
              </div>
            </div>

            {isLoading && group.title !== "Principale" && group.title !== "Prodotto e brand" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {[1,2,3,4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <div className="group flex items-center gap-3 p-3.5 rounded-xl border bg-card hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                      {item.iconName ? (
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <SectorIcon name={item.iconName} size={16} />
                        </div>
                      ) : (
                        <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium text-foreground leading-snug truncate">{item.label}</p>
                          {item.badge && (
                            <span className="text-[10px] font-semibold bg-primary/10 text-primary rounded-full px-1.5 py-0.5 shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {item.desc && (
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{item.desc}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ))}

        {/* CTA */}
        <div className="bg-primary/5 border border-primary/20 rounded-3xl p-10 text-center">
          <Star className="w-10 h-10 text-primary mx-auto mb-3 opacity-80 fill-primary/20" />
          <h2 className="text-xl font-serif font-bold text-foreground mb-2">
            Non sai da dove iniziare?
          </h2>
          <p className="text-muted-foreground text-sm mb-5 max-w-sm mx-auto">
            Il test ti guida in 10 minuti verso i settori professionali più coerenti con la tua personalità.
          </p>
          <Button asChild className="rounded-full px-8">
            <Link href="/test">Inizia il test gratuito <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
          </Button>
        </div>

      </div>
    </div>
  );
}
