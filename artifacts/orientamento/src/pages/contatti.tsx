import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Mail, MessageCircle, CheckCircle2, Loader2,
  ArrowRight, Shield, Clock, Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const BASE = import.meta.env.BASE_URL || "/";


export default function Contatti() {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = t("contatti.pageTitle", { defaultValue: "Contatti — NorthStar" });
    const meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (meta) meta.content = t("contatti.pageDesc", { defaultValue: "Contatta il team di NorthStar per supporto, informazioni sui piani Premium, feedback o domande sulla privacy. Rispondiamo entro 24 ore." });
  }, [t]);

  const SUBJECTS = t("contatti.subjects", { returnObjects: true }) as Array<{ value: string; label: string }>;
  const FAQ = t("contatti.faq", { returnObjects: true }) as Array<{ q: string; a: string }>;

  const [form, setForm] = useState({ name: "", email: "", subject: "info", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  function setField(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch(`${BASE}api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Errore invio messaggio");
      }
      setStatus("sent");
      setForm({ name: "", email: "", subject: "info", message: "" });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Errore di rete. Riprova.");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen">

      {/* Header */}
      <section className="border-b bg-gradient-to-b from-primary/5 to-background py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-5">
            <MessageCircle className="w-4 h-4" />
            {t("contatti.badge")}
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
            {t("contatti.title")}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
            {t("contatti.subtitle")}
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-5xl py-14">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">

          {/* Form — left/main */}
          <div className="lg:col-span-3">
            <h2 className="text-xl font-serif font-bold text-foreground mb-6">{t("contatti.sendMessage")}</h2>

            {status === "sent" ? (
              <div className="rounded-3xl border bg-emerald-50 border-emerald-200 p-10 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-serif font-bold text-foreground mb-2">{t("contatti.sent")}</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  {t("contatti.sentDesc")}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button className="rounded-full" onClick={() => setStatus("idle")}>
                    {t("contatti.sendAnother")}
                  </Button>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link href="/">{t("notFound.goHome")}</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Name + Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">{t("profilo.name")} *</Label>
                    <Input
                      id="name"
                      placeholder="Mario Rossi"
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      required
                      maxLength={80}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">{t("profilo.email")} *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="mario@esempio.it"
                      value={form.email}
                      onChange={(e) => setField("email", e.target.value)}
                      required
                      maxLength={120}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <Label>{t("contatti.subjectLabel")} *</Label>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECTS.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setField("subject", s.value)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors",
                          form.subject === s.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/40"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div className="space-y-1.5">
                  <Label htmlFor="message">
                    {t("contatti.message")} *
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      {form.message.length}/1000
                    </span>
                  </Label>
                  <textarea
                    id="message"
                    placeholder={t("contatti.messagePlaceholder")}
                    value={form.message}
                    onChange={(e) => setField("message", e.target.value)}
                    required
                    maxLength={1000}
                    rows={6}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>

                {/* Privacy notice */}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("contatti.privacyNotice", { defaultValue: "Inviando questo modulo accetti il trattamento dei tuoi dati personali per rispondere alla tua richiesta, come descritto nella nostra" })}{" "}
                  <Link href="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>.
                </p>

                {status === "error" && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3">
                    {errorMsg}
                  </p>
                )}

                <Button
                  type="submit"
                  className="rounded-full px-8"
                  disabled={status === "sending" || !form.name.trim() || !form.email.trim() || !form.message.trim()}
                >
                  {status === "sending" ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("contatti.sending")}</>
                  ) : (
                    <>{t("contatti.submit")} <ArrowRight className="w-4 h-4 ml-2" /></>
                  )}
                </Button>
              </form>
            )}
          </div>

          {/* Info sidebar — right */}
          <div className="lg:col-span-2 space-y-6">

            {/* Contact info */}
            <div className="rounded-2xl border bg-card p-6 space-y-5">
              <h2 className="font-serif font-bold text-foreground">{t("contatti.contactInfo")}</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t("contatti.generalEmail")}</p>
                    <a href="mailto:info@northstar.app" className="text-sm text-primary hover:underline">
                      info@northstar.app
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t("contatti.privacyEmail")}</p>
                    <a href="mailto:privacy@northstar.app" className="text-sm text-primary hover:underline">
                      privacy@northstar.app
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t("contatti.responseTime", { defaultValue: "Tempi di risposta" })}</p>
                    <p className="text-sm text-muted-foreground">{t("contatti.responseTimeDesc", { defaultValue: "Entro 24 ore lavorative" })}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t("contatti.team", { defaultValue: "Team" })}</p>
                    <p className="text-sm text-muted-foreground">{t("contatti.teamDesc", { defaultValue: "Piccolo team, risposte umane" })}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick links */}
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="font-serif font-bold text-foreground mb-4">{t("contatti.usefulLinks", { defaultValue: "Link utili" })}</h2>
              <div className="space-y-2">
                {[
                  { label: t("nav.startFreeTest", { defaultValue: "Inizia il test gratuito" }), href: "/test" },
                  { label: t("contatti.explorePremium", { defaultValue: "Esplora il Premium" }),  href: "/premium" },
                  { label: "Privacy Policy",                                                       href: "/privacy-policy" },
                  { label: t("footer.links.terms", { defaultValue: "Termini di servizio" }),       href: "/termini-di-servizio" },
                  { label: t("footer.about", { defaultValue: "Chi siamo" }),                       href: "/chi-siamo" },
                ].map((link) => (
                  <Link key={link.href} href={link.href}>
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground hover:text-primary transition-colors group cursor-pointer">
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      {link.label}
                    </div>
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* FAQ section */}
        <div className="mt-16">
          <h2 className="text-2xl font-serif font-bold text-foreground mb-8 text-center">
            {t("comeFunziona.faqTitle", { defaultValue: "Domande frequenti" })}
          </h2>
          <div className="max-w-3xl mx-auto space-y-3">
            {FAQ.map((item, i) => (
              <div key={i} className="rounded-2xl border bg-card overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-medium text-foreground pr-4">{item.q}</span>
                  <span
                    className={cn(
                      "text-muted-foreground shrink-0 transition-transform",
                      openFaq === i && "rotate-180"
                    )}
                  >
                    ▾
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t pt-4">
                    {item.a}
                    {item.q.includes("Privacy") && (
                      <Link href="/privacy-policy" className="ml-1 text-primary hover:underline">
                        {t("contatti.readPrivacy", { defaultValue: "Leggi la Privacy Policy →" })}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
