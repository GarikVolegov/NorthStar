import { useWendy } from "@/contexts/WendyProvider";
import { ArrowRight, BarChart3, Bot, Briefcase, Building2, Newspaper, Rocket, Sparkles, TrendingUp, Zap } from "lucide-react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

export function QuickToolsSection({
  journeyType,
  sessionId,
}: {
  journeyType: string | null | undefined;
  sessionId?: number;
}) {
  const { t } = useTranslation();
  const wendy = useWendy();
  type ToolDef = {
    href: string;
    icon: React.ElementType;
    title: string;
    desc: string;
    badge?: string;
  };

  const ALL_TOOLS: Record<string, ToolDef[]> = {
    indeciso: [
      {
        href: "/test",
        icon: Zap,
        title: t("home.tools.indeciso.0.title"),
        desc: t("home.tools.indeciso.0.desc"),
      },
      {
        href: "/settori",
        icon: TrendingUp,
        title: t("home.tools.indeciso.1.title"),
        desc: t("home.tools.indeciso.1.desc"),
      },
      {
        href: "#wendy",
        icon: Bot,
        title: t("home.tools.indeciso.2.title"),
        desc: t("home.tools.indeciso.2.desc"),
        badge: "Pro",
      },
      {
        href: "/news",
        icon: Newspaper,
        title: t("home.tools.indeciso.3.title"),
        desc: t("home.tools.indeciso.3.desc"),
      },
    ],
    dipendente: [
      {
        href: sessionId ? `/skills-gap/${sessionId}` : "/dashboard",
        icon: Zap,
        title: t("home.tools.dipendente.0.title"),
        desc: t("home.tools.dipendente.0.desc"),
        badge: "AI",
      },
      {
        href: "#wendy",
        icon: TrendingUp,
        title: t("home.tools.dipendente.1.title"),
        desc: t("home.tools.dipendente.1.desc"),
        badge: "AI",
      },
      {
        href: "#wendy",
        icon: Bot,
        title: t("home.tools.dipendente.2.title"),
        desc: t("home.tools.dipendente.2.desc"),
      },
      {
        href: "/candidature",
        icon: Briefcase,
        title: t("home.tools.dipendente.3.title"),
        desc: t("home.tools.dipendente.3.desc"),
      },
    ],
    autonomo: [
      {
        href: "#wendy",
        icon: Rocket,
        title: t("home.tools.autonomo.0.title"),
        desc: t("home.tools.autonomo.0.desc"),
        badge: "AI",
      },
      {
        href: "#wendy",
        icon: Bot,
        title: t("home.tools.autonomo.1.title"),
        desc: t("home.tools.autonomo.1.desc"),
      },
      {
        href: "/settori",
        icon: TrendingUp,
        title: t("home.tools.autonomo.2.title"),
        desc: t("home.tools.autonomo.2.desc"),
      },
      {
        href: "/news",
        icon: Newspaper,
        title: t("home.tools.autonomo.3.title"),
        desc: t("home.tools.autonomo.3.desc"),
      },
    ],
    azienda: [
      {
        href: "/settori",
        icon: TrendingUp,
        title: t("home.tools.azienda.0.title"),
        desc: t("home.tools.azienda.0.desc"),
      },
      {
        href: "/affiliazione",
        icon: Building2,
        title: t("home.tools.azienda.1.title"),
        desc: t("home.tools.azienda.1.desc"),
      },
      {
        href: "/news",
        icon: Newspaper,
        title: t("home.tools.azienda.2.title"),
        desc: t("home.tools.azienda.2.desc"),
      },
      {
        href: "/crescita",
        icon: Sparkles,
        title: t("home.tools.azienda.3.title"),
        desc: t("home.tools.azienda.3.desc"),
      },
    ],
    investitore: [
      {
        href: "/settori",
        icon: BarChart3,
        title: t("home.tools.investitore.0.title"),
        desc: t("home.tools.investitore.0.desc"),
      },
      {
        href: "/news",
        icon: Newspaper,
        title: t("home.tools.investitore.1.title"),
        desc: t("home.tools.investitore.1.desc"),
      },
      {
        href: "/crescita",
        icon: TrendingUp,
        title: t("home.tools.investitore.2.title"),
        desc: t("home.tools.investitore.2.desc"),
      },
      {
        href: sessionId ? `/grafo` : "/settori",
        icon: Sparkles,
        title: t("home.tools.investitore.3.title"),
        desc: t("home.tools.investitore.3.desc"),
      },
    ],
  };

  const tools =
    journeyType && ALL_TOOLS[journeyType]
      ? ALL_TOOLS[journeyType]
      : (ALL_TOOLS.indeciso ?? []);

  return (
    <section className="py-10 border-b border-border">
      <div className="container mx-auto px-4 md:px-6 max-w-6xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-xl text-foreground">
              {t("home.quickTools.heading")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("home.quickTools.subheading")}
            </p>
          </div>
          <Link href="/dashboard" className="ml-auto">
            <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2 transition-all">
              {t("home.quickTools.dashboardLink")}{" "}
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tools.map(({ href, icon: Icon, title, desc, badge }) => {
            const content = (
              <div className="group rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 hover:border-primary/30 hover:shadow-md hover:shadow-black/10 transition-all duration-200 cursor-pointer h-full">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:bg-primary/15 transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  {badge && (
                    <span className="text-xs font-semibold bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">
                      {badge}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm leading-snug">
                    {title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {desc}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 mt-auto self-end text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            );
            if (href === "#wendy") {
              return (
                <button
                  key={title}
                  onClick={() => wendy.open()}
                  className="block w-full text-left"
                >
                  {content}
                </button>
              );
            }
            return (
              <Link key={title} href={href}>
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

