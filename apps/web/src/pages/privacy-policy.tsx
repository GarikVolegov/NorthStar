import { Button } from "@/components/ui/button";
import { ArrowRight, Mail, Shield } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

interface SectionProps { id: string; title: string; children: React.ReactNode; }
function Section({ id, title, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl md:text-2xl font-serif font-bold text-foreground mb-4 pb-3 border-b">{title}</h2>
      <div className="prose-like space-y-3 text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

const LAST_UPDATE = "1 maggio 2025";

export default function PrivacyPolicy() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t("privacy.title")} — NorthStar`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement("meta"); (meta as HTMLMetaElement).name = "description"; document.head.appendChild(meta); }
    (meta as HTMLMetaElement).content = t("privacy.intro");
  }, [t]);

  const TOC = [
    { id: "titolare",      label: t("privacy.s1Title") },
    { id: "dati",          label: t("privacy.s2Title") },
    { id: "finalita",      label: t("privacy.s3Title") },
    { id: "cookie",        label: t("privacy.s4Title") },
    { id: "conservazione", label: t("privacy.s5Title") },
    { id: "destinatari",   label: t("privacy.s6Title") },
    { id: "diritti",       label: t("privacy.s7Title") },
    { id: "aggiornamenti", label: t("privacy.s8Title") },
  ];

  const s2Items: string[] = t("privacy.s2Items", { returnObjects: true }) as string[];
  const s3Bases: { base: string; desc: string }[] = t("privacy.s3Bases", { returnObjects: true }) as { base: string; desc: string }[];
  const s5Items: string[] = t("privacy.s5Items", { returnObjects: true }) as string[];
  const s6Items: string[] = t("privacy.s6Items", { returnObjects: true }) as string[];
  const s7Rights: { right: string; desc: string }[] = t("privacy.s7Rights", { returnObjects: true }) as { right: string; desc: string }[];

  return (
    <div className="min-h-screen">

      {/* Header */}
      <section className="border-b bg-gradient-to-b from-muted/40 to-background py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-4 py-1.5 text-sm font-medium mb-5">
            <Shield className="w-4 h-4" />
            {t("privacy.badge")}
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">{t("privacy.title")}</h1>
          <p className="text-muted-foreground text-lg leading-relaxed mb-3">{t("privacy.intro")}</p>
          <p className="text-sm text-muted-foreground">{t("privacy.lastUpdated")}: <strong>{LAST_UPDATE}</strong></p>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-5xl py-14">
        <div className="flex flex-col lg:flex-row gap-10">

          {/* Sticky TOC */}
          <aside className="lg:w-56 shrink-0">
            <div className="lg:sticky lg:top-24">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t("privacy.toc")}</p>
              <nav className="space-y-1">
                {TOC.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block text-sm text-muted-foreground hover:text-primary py-1 hover:translate-x-0.5 transition-all"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 space-y-12">

            <Section id="titolare" title={t("privacy.s1Title")}>
              <p>{t("privacy.s1P1")}</p>
              <p>{t("privacy.s1P2")} <a href="mailto:privacy@northstar.app" className="text-primary hover:underline font-medium">privacy@northstar.app</a></p>
            </Section>

            <Section id="dati" title={t("privacy.s2Title")}>
              <p>{t("privacy.s2Intro")}</p>
              <ul className="space-y-2 pl-4">
                {s2Items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </Section>

            <Section id="finalita" title={t("privacy.s3Title")}>
              <p>{t("privacy.s3Intro")}</p>
              <div className="space-y-3">
                {s3Bases.map(({ base, desc }) => (
                  <div key={base} className="p-4 rounded-xl border bg-card">
                    <p className="text-sm font-semibold text-foreground mb-1">{base}</p>
                    <p className="text-sm">{desc}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="cookie" title={t("privacy.s4Title")}>
              <p>{t("privacy.s4P1")}</p>
              <p>{t("privacy.s4P2")}</p>
              <div className="p-4 rounded-xl bg-muted/50 border text-sm">
                <p className="font-medium text-foreground mb-1">{t("privacy.s4BoxTitle")}</p>
                <p>{t("privacy.s4BoxText")}</p>
              </div>
            </Section>

            <Section id="conservazione" title={t("privacy.s5Title")}>
              <p>{t("privacy.s5Intro")}</p>
              <ul className="space-y-2 pl-4">
                {s5Items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </Section>

            <Section id="destinatari" title={t("privacy.s6Title")}>
              <p>{t("privacy.s6Intro")}</p>
              <ul className="space-y-2 pl-4">
                {s6Items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <p>{t("privacy.s6Footer")}</p>
            </Section>

            <Section id="diritti" title={t("privacy.s7Title")}>
              <p>{t("privacy.s7Intro")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {s7Rights.map(({ right, desc }) => (
                  <div key={right} className="p-3 rounded-xl border bg-card">
                    <p className="text-sm font-semibold text-foreground">{right}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
              <p>{t("privacy.s7Footer")} <a href="mailto:privacy@northstar.app" className="text-primary hover:underline font-medium">privacy@northstar.app</a>.</p>
            </Section>

            <Section id="aggiornamenti" title={t("privacy.s8Title")}>
              <p>{t("privacy.s8P1")}</p>
              <p>{t("privacy.s8P2")}</p>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                <p className="font-medium mb-1">{t("privacy.legalNote")}</p>
                <p>{t("privacy.legalNoteText")}</p>
              </div>
            </Section>

            {/* CTA */}
            <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 text-center">
              <Mail className="w-10 h-10 text-primary mx-auto mb-3 opacity-80" />
              <h2 className="text-xl font-serif font-bold text-foreground mb-2">{t("privacy.ctaTitle")}</h2>
              <p className="text-muted-foreground text-sm mb-5">{t("privacy.ctaDesc")}</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a href="mailto:privacy@northstar.app">
                  <Button className="rounded-full">{t("privacy.ctaBtn")} <ArrowRight className="w-4 h-4 ml-1.5" /></Button>
                </a>
                <Button asChild variant="outline" className="rounded-full">
                  <Link href="/termini-di-servizio">{t("privacy.ctaLink")}</Link>
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
