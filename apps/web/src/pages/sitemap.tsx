import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getJson } from "@/lib/apiClient";
import { SITEMAP_GROUP_COLORS } from "@/lib/constants";
import { SectorIcon } from "@/lib/sector-icon";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  ExternalLink,
  GitBranch,
  Globe,
  Home,
  Info,
  Map,
  Network,
  Star
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

interface Sector { id: number; name: string; icon: string; }

function useSectors() {
  return useQuery<Sector[]>({
    queryKey: ["sectors-list"],
    queryFn: () => getJson<Sector[]>(`${BASE}api/sectors`),
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

const SITEMAP_COLORS = {
  navigation: SITEMAP_GROUP_COLORS.navigation!,
  sectors: SITEMAP_GROUP_COLORS.sectors!,
  brand: SITEMAP_GROUP_COLORS.brand!,
  wiki: SITEMAP_GROUP_COLORS.wiki!,
  roadmap: SITEMAP_GROUP_COLORS.roadmap!,
  graph: SITEMAP_GROUP_COLORS.graph!,
};

export default function Sitemap() {
  const { t } = useTranslation();
  const { data: sectors = [], isLoading } = useSectors();

  useEffect(() => {
    document.title = `${t("sitemap.title")} — NorthStar`;
    const meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (meta) meta.content = t("sitemap.desc");
  }, [t]);

  const STATIC_GROUPS: SitemapGroup[] = useMemo(() => [
    {
      title: t("sitemap.groups.main"),
      icon: Home,
      color: SITEMAP_COLORS.navigation.color,
      bg: SITEMAP_COLORS.navigation.bg,
      items: [
        { label: t("sitemap.items.home.label"),      href: "/",         desc: t("sitemap.items.home.desc") },
        { label: t("sitemap.items.test.label"),      href: "/test",     desc: t("sitemap.items.test.desc") },
        { label: t("sitemap.items.news.label"),      href: "/news",     desc: t("sitemap.items.news.desc") },
        { label: t("sitemap.items.premium.label"),   href: "/premium",  desc: t("sitemap.items.premium.desc") },
        { label: t("sitemap.items.profilo.label"),   href: "/profilo",  desc: t("sitemap.items.profilo.desc") },
      ],
    },
    {
      title: t("sitemap.groups.sectors"),
      icon: Globe,
      color: SITEMAP_COLORS.sectors.color,
      bg: SITEMAP_COLORS.sectors.bg,
      items: [
        { label: t("sitemap.items.settori.label"),   href: "/settori",   desc: t("sitemap.items.settori.desc") },
        { label: t("sitemap.items.confronta.label"), href: "/confronta", desc: t("sitemap.items.confronta.desc") },
      ],
    },
    {
      title: t("sitemap.groups.brand"),
      icon: Info,
      color: SITEMAP_COLORS.brand.color,
      bg: SITEMAP_COLORS.brand.bg,
      items: [
        { label: t("sitemap.items.chiSiamo.label"),    href: "/chi-siamo",           desc: t("sitemap.items.chiSiamo.desc") },
        { label: t("sitemap.items.comeFunziona.label"),href: "/come-funziona",       desc: t("sitemap.items.comeFunziona.desc") },
        { label: t("sitemap.items.contatti.label"),    href: "/contatti",            desc: t("sitemap.items.contatti.desc") },
        { label: t("sitemap.items.sitemapPage.label"), href: "/sitemap",             desc: t("sitemap.items.sitemapPage.desc") },
        { label: t("sitemap.items.privacy.label"),     href: "/privacy-policy",      desc: t("sitemap.items.privacy.desc") },
        { label: t("sitemap.items.termini.label"),     href: "/termini-di-servizio", desc: t("sitemap.items.termini.desc") },
      ],
    },
  ], [t]);

  const sectorGroups: SitemapGroup[] = useMemo(() => sectors.length > 0 ? [
    {
      title: t("sitemap.groups.sectorPages"),
      icon: Globe,
      color: SITEMAP_COLORS.sectors.color,
      bg: SITEMAP_COLORS.sectors.bg,
      items: sectors.map((s) => ({
        label: s.name,
        iconName: s.icon,
        href: `/settore/${s.id}`,
        desc: t("sitemap.sectorDesc"),
      })),
    },
    {
      title: t("sitemap.groups.wiki"),
      icon: BookOpen,
      color: SITEMAP_COLORS.wiki.color,
      bg: SITEMAP_COLORS.wiki.bg,
      items: sectors.map((s) => ({
        label: s.name,
        iconName: s.icon,
        href: "#wendy",
        desc: t("sitemap.wikiDesc"),
        badge: "Wendy AI",
      })),
    },
    {
      title: t("sitemap.groups.roadmap"),
      icon: GitBranch,
      color: SITEMAP_COLORS.roadmap.color,
      bg: SITEMAP_COLORS.roadmap.bg,
      items: sectors.map((s) => ({
        label: s.name,
        iconName: s.icon,
        href: `/roadmap/${s.id}`,
        desc: t("sitemap.roadmapDesc"),
        badge: "Premium",
      })),
    },
    {
      title: t("sitemap.groups.grafo"),
      icon: Network,
      color: SITEMAP_COLORS.graph.color,
      bg: SITEMAP_COLORS.graph.bg,
      items: sectors.map((s) => ({
        label: s.name,
        iconName: s.icon,
        href: `/grafo/${s.id}`,
        desc: t("sitemap.grafoDesc"),
        badge: "Premium",
      })),
    },
  ] : [], [sectors, t]);

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
            {t("sitemap.nav")}
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
            {t("sitemap.title")}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-6">
            {t("sitemap.desc")}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border rounded-xl px-3 py-2">
              <Globe className="w-4 h-4 text-primary" />
              {isLoading ? "…" : t("sitemap.pagesTotal", { count: totalPages })}
            </div>
            <a
              href={`${BASE}api/sitemap.xml`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t("sitemap.downloadXml")}
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
                <p className="text-xs text-muted-foreground">{group.items.length} {t("sitemap.pages")}</p>
              </div>
            </div>

            {isLoading && group.title !== t("sitemap.groups.main") && group.title !== t("sitemap.groups.brand") ? (
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
            {t("sitemap.ctaTitle")}
          </h2>
          <p className="text-muted-foreground text-sm mb-5 max-w-sm mx-auto">
            {t("sitemap.ctaDesc")}
          </p>
          <Button asChild className="rounded-full px-8">
            <Link href="/test">{t("sitemap.startTest")} <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
          </Button>
        </div>

      </div>
    </div>
  );
}
