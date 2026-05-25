import { Button } from "@/components/ui/button";
import { ArrowRight, FileText } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

interface SectionProps { id: string; title: string; children: React.ReactNode; }
function Section({ id, title, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl md:text-2xl font-serif font-bold text-foreground mb-4 pb-3 border-b">{title}</h2>
      <div className="space-y-3 text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

const LAST_UPDATE = "1 maggio 2025";

export default function TerminiDiServizio() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t("terms.title")} — NorthStar`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement("meta"); (meta as HTMLMetaElement).name = "description"; document.head.appendChild(meta); }
    (meta as HTMLMetaElement).content = t("terms.intro");
  }, [t]);

  const TOC = [
    { id: "oggetto",        label: t("terms.s1Title") },
    { id: "account",        label: t("terms.s2Title") },
    { id: "piani",          label: t("terms.s3Title") },
    { id: "pagamenti",      label: t("terms.s4Title") },
    { id: "uso",            label: t("terms.s5Title") },
    { id: "proprieta",      label: t("terms.s6Title") },
    { id: "responsabilita", label: t("terms.s7Title") },
    { id: "legge",          label: t("terms.s8Title") },
  ];

  const s2Items: string[] = t("terms.s2Items", { returnObjects: true }) as string[];
  const s3FreeItems: string[] = t("terms.s3FreeItems", { returnObjects: true }) as string[];
  const s3PremiumItems: string[] = t("terms.s3PremiumItems", { returnObjects: true }) as string[];
  const s4Items: { t: string; d: string }[] = t("terms.s4Items", { returnObjects: true }) as { t: string; d: string }[];
  const s5Items: string[] = t("terms.s5Items", { returnObjects: true }) as string[];
  const s7Items: string[] = t("terms.s7Items", { returnObjects: true }) as string[];

  return (
    <div className="min-h-screen">

      {/* Header */}
      <section className="border-b bg-gradient-to-b from-muted/40 to-background py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-4 py-1.5 text-sm font-medium mb-5">
            <FileText className="w-4 h-4" />
            {t("terms.badge")}
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">{t("terms.title")}</h1>
          <p className="text-muted-foreground text-lg leading-relaxed mb-3">{t("terms.intro")}</p>
          <p className="text-sm text-muted-foreground">{t("terms.lastUpdated")}: <strong>{LAST_UPDATE}</strong></p>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-5xl py-14">
        <div className="flex flex-col lg:flex-row gap-10">

          {/* Sticky TOC */}
          <aside className="lg:w-56 shrink-0">
            <div className="lg:sticky lg:top-24">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t("terms.toc")}</p>
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

            <Section id="oggetto" title={t("terms.s1Title")}>
              <p>{t("terms.s1P1")}</p>
              <p>{t("terms.s1P2")}</p>
            </Section>

            <Section id="account" title={t("terms.s2Title")}>
              <p>{t("terms.s2Intro")}</p>
              <ul className="space-y-2 pl-4">
                {s2Items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <p>{t("terms.s2Footer")}</p>
            </Section>

            <Section id="piani" title={t("terms.s3Title")}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl border bg-card">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🆓</span>
                    <p className="font-semibold text-foreground">{t("terms.s3FreePlan")}</p>
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    {s3FreeItems.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-muted-foreground">
                        <span className="text-emerald-500">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-5 rounded-2xl border border-primary/30 bg-primary/5 ring-1 ring-primary/10">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">⭐</span>
                    <p className="font-semibold text-foreground">{t("terms.s3PremiumPlan")}</p>
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    {s3PremiumItems.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-muted-foreground">
                        <span className="text-primary">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Section>

            <Section id="pagamenti" title={t("terms.s4Title")}>
              <p>{t("terms.s4Intro")}</p>
              <div className="space-y-3">
                {s4Items.map(({ t: title, d: desc }) => (
                  <div key={title} className="p-4 rounded-xl border bg-card">
                    <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
                    <p className="text-sm">{desc}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="uso" title={t("terms.s5Title")}>
              <p>{t("terms.s5Intro")}</p>
              <ul className="space-y-2 pl-4">
                {s5Items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </Section>

            <Section id="proprieta" title={t("terms.s6Title")}>
              <p>{t("terms.s6P1")}</p>
              <p>{t("terms.s6P2")}</p>
              <p>{t("terms.s6P3")}</p>
            </Section>

            <Section id="responsabilita" title={t("terms.s7Title")}>
              <p>{t("terms.s7Intro")}</p>
              <ul className="space-y-1.5 pl-4">
                {s7Items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <p>{t("terms.s7Footer")}</p>
            </Section>

            <Section id="legge" title={t("terms.s8Title")}>
              <p>{t("terms.s8P1")}</p>
              <p>{t("terms.s8P2")}</p>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                <p className="font-medium mb-1">{t("terms.legalNote")}</p>
                <p>{t("terms.legalNoteText")}</p>
              </div>
            </Section>

            {/* CTA */}
            <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 text-center">
              <h2 className="text-xl font-serif font-bold text-foreground mb-2">{t("terms.ctaTitle")}</h2>
              <p className="text-muted-foreground text-sm mb-5">{t("terms.ctaDesc")}</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a href="mailto:info@northstar.app">
                  <Button className="rounded-full">{t("terms.ctaBtn")} <ArrowRight className="w-4 h-4 ml-1.5" /></Button>
                </a>
                <Button asChild variant="outline" className="rounded-full">
                  <Link href="/privacy-policy">{t("terms.ctaLink")}</Link>
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
