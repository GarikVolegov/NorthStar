import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postJson } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, Clock, Loader2, Mail, MessageCircle, Shield, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { z } from "zod";

const BASE = import.meta.env.BASE_URL || "/";

const contactSchema = z.object({
  name: z.string().min(2, "Nome troppo corto").max(80, "Nome troppo lungo"),
  email: z.string().email("Email non valida").max(120),
  subject: z.string().min(1),
  message: z.string().min(10, "Messaggio troppo breve (min. 10 caratteri)").max(1000, "Messaggio troppo lungo (max. 1000 caratteri)"),
});

type ContactFormData = z.infer<typeof contactSchema>;

export default function Contatti() {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = t("contatti.pageTitle", { defaultValue: "Contatti — NorthStar" });
    const meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (meta) meta.content = t("contatti.pageDesc", { defaultValue: "Contatta il team di NorthStar per supporto, informazioni sui piani Premium, feedback o domande sulla privacy. Rispondiamo entro 24 ore." });
  }, [t]);

  const SUBJECTS = t("contatti.subjects", { returnObjects: true }) as Array<{ value: string; label: string }>;
  const FAQ = t("contatti.faq", { returnObjects: true }) as Array<{ q: string; a: string }>;

  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", subject: "info", message: "" },
  });

  const messageValue = watch("message");

  async function onSubmit(data: ContactFormData) {
    setStatus("sending");
    setErrorMsg("");
    try {
      await postJson(`${BASE}api/contact`, data);
      setStatus("sent");
      reset();
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
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

                {/* Name + Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">{t("profilo.name")} *</Label>
                    <Input
                      id="name"
                      placeholder="Mario Rossi"
                      {...register("name")}
                      className={cn("rounded-xl", errors.name && "border-destructive")}
                    />
                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">{t("profilo.email")} *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="mario@esempio.it"
                      {...register("email")}
                      className={cn("rounded-xl", errors.email && "border-destructive")}
                    />
                    {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <Label>{t("contatti.subjectLabel")} *</Label>
                  <Controller
                    control={control}
                    name="subject"
                    render={({ field }) => (
                      <div className="flex flex-wrap gap-2">
                        {SUBJECTS.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => field.onChange(s.value)}
                            className={cn(
                              "px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors",
                              field.value === s.value
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-background text-muted-foreground hover:border-primary/40"
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  />
                </div>

                {/* Message */}
                <div className="space-y-1.5">
                  <Label htmlFor="message">
                    {t("contatti.message")} *
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      {(messageValue ?? "").length}/1000
                    </span>
                  </Label>
                  <textarea
                    id="message"
                    placeholder={t("contatti.messagePlaceholder")}
                    {...register("message")}
                    maxLength={1000}
                    rows={6}
                    className={cn(
                      "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none",
                      errors.message && "border-destructive"
                    )}
                  />
                  {errors.message && <p className="text-xs text-destructive">{errors.message.message}</p>}
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
                  disabled={status === "sending"}
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

          {/* Sidebar */}
          <div className="lg:col-span-2 space-y-8">
            {/* Contact info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">{t("contatti.contactInfo", { defaultValue: "Come raggiungerci" })}</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Email</p>
                    <p className="text-sm text-muted-foreground">support@northstar.app</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t("contatti.responseTime", { defaultValue: "Tempi di risposta" })}</p>
                    <p className="text-sm text-muted-foreground">{t("contatti.responseTimeDesc", { defaultValue: "Entro 24 ore nei giorni lavorativi" })}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t("contatti.community", { defaultValue: "Community" })}</p>
                    <p className="text-sm text-muted-foreground">{t("contatti.communityDesc", { defaultValue: "Unisciti alla community NorthStar" })}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy badge */}
            <div className="rounded-2xl border bg-card p-5 flex items-start gap-3">
              <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">{t("contatti.privacy", { defaultValue: "I tuoi dati sono al sicuro" })}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("contatti.privacyDesc", { defaultValue: "Non condividiamo mai i tuoi dati con terze parti. Puoi leggere la nostra" })}{" "}
                  <Link href="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>.
                </p>
              </div>
            </div>

            {/* FAQ */}
            {Array.isArray(FAQ) && FAQ.length > 0 && (
              <div>
                <h3 className="font-semibold text-foreground mb-3">FAQ</h3>
                <div className="space-y-2">
                  {FAQ.map((item, i) => (
                    <div key={i} className="rounded-xl border bg-card overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="w-full text-left px-4 py-3 text-sm font-medium flex items-center justify-between gap-2"
                      >
                        <span>{item.q}</span>
                        <span className="text-muted-foreground text-xs shrink-0">{openFaq === i ? "▲" : "▼"}</span>
                      </button>
                      {openFaq === i && (
                        <div className="px-4 pb-3 text-sm text-muted-foreground border-t">{item.a}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
