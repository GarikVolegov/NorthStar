import { useEffect } from "react";
import { Link } from "wouter";
import { FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function useSeo(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement("meta"); (meta as HTMLMetaElement).name = "description"; document.head.appendChild(meta); }
    (meta as HTMLMetaElement).content = description;
  }, [title, description]);
}

const LAST_UPDATE = "1 maggio 2025";

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

const TOC = [
  { id: "oggetto",           label: "Oggetto del servizio" },
  { id: "account",           label: "Account e registrazione" },
  { id: "piani",             label: "Piani Free e Premium" },
  { id: "pagamenti",         label: "Pagamenti e rinnovi" },
  { id: "uso",               label: "Uso consentito e vietato" },
  { id: "proprieta",         label: "Proprietà intellettuale" },
  { id: "responsabilita",    label: "Limitazione di responsabilità" },
  { id: "legge",             label: "Legge applicabile e foro competente" },
];

export default function TerminiDiServizio() {
  useSeo(
    "Termini di servizio — NorthStar",
    "Leggi i Termini di servizio di NorthStar: condizioni d'uso, piani Free e Premium, pagamenti, diritti e limitazioni della piattaforma di orientamento e crescita personale."
  );

  return (
    <div className="min-h-screen">

      {/* Header */}
      <section className="border-b bg-gradient-to-b from-muted/40 to-background py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-4 py-1.5 text-sm font-medium mb-5">
            <FileText className="w-4 h-4" />
            Condizioni d'uso del servizio
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">Termini di servizio</h1>
          <p className="text-muted-foreground text-lg leading-relaxed mb-3">
            Accedendo o utilizzando NorthStar, l'utente accetta integralmente i presenti Termini di servizio. Si consiglia di leggerli con attenzione.
          </p>
          <p className="text-sm text-muted-foreground">Ultimo aggiornamento: <strong>{LAST_UPDATE}</strong></p>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-5xl py-14">
        <div className="flex flex-col lg:flex-row gap-10">

          {/* Sticky TOC */}
          <aside className="lg:w-56 shrink-0">
            <div className="lg:sticky lg:top-24">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Indice</p>
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

            <Section id="oggetto" title="Oggetto del servizio">
              <p>NorthStar è una piattaforma SaaS di orientamento e crescita personale che fornisce strumenti informativi per l'analisi della personalità, la scoperta di settori professionali, la lettura di contenuti formativi e la pianificazione del percorso di carriera.</p>
              <p>Le informazioni fornite dalla piattaforma hanno <strong className="text-foreground">scopo esclusivamente informativo</strong> e non costituiscono consulenza professionale specialistica di natura psicologica, legale, medica o finanziaria. Per decisioni importanti, si raccomanda di rivolgersi a professionisti qualificati.</p>
            </Section>

            <Section id="account" title="Account e registrazione">
              <p>Per accedere alle funzionalità riservate è necessario creare un account fornendo nome, indirizzo email e password. L'utente è responsabile di:</p>
              <ul className="space-y-2 pl-4">
                {[
                  "Mantenere le proprie credenziali riservate e non condividerle con terzi.",
                  "Fornire informazioni accurate e aggiornate durante la registrazione.",
                  "Notificare immediatamente NorthStar in caso di accesso non autorizzato al proprio account.",
                  "Rispettare le presenti condizioni d'uso nell'utilizzo della piattaforma.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <p>NorthStar si riserva il diritto di sospendere o eliminare account che violino i presenti Termini.</p>
            </Section>

            <Section id="piani" title="Piani Free e Premium">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl border bg-card">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🆓</span>
                    <p className="font-semibold text-foreground">Piano Free</p>
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    {[
                      "Test RIASEC + Cinque Spiriti",
                      "Risultati base e profilo personalità",
                      "Accesso a 21 settori professionali",
                      "News generali e settoriali",
                      "Fino a 5 obiettivi di carriera",
                      "Salvataggio preferenze base",
                    ].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-muted-foreground">
                        <span className="text-emerald-500">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-5 rounded-2xl border border-primary/30 bg-primary/5 ring-1 ring-primary/10">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">⭐</span>
                    <p className="font-semibold text-foreground">Piano Premium</p>
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    {[
                      "Tutto il piano Free",
                      "Wiki AI per ogni settore",
                      "Roadmap di carriera personalizzata",
                      "Grafo della conoscenza interattivo",
                      "Chat RAG con il grafo",
                      "Obiettivi di carriera illimitati",
                      "Contenuti premium esclusivi",
                    ].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-muted-foreground">
                        <span className="text-primary">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Section>

            <Section id="pagamenti" title="Pagamenti e rinnovi">
              <p>Il Piano Premium è disponibile con abbonamento mensile o annuale. I pagamenti vengono elaborati in modo sicuro da <strong className="text-foreground">Stripe</strong>, un fornitore certificato PCI-DSS. NorthStar non memorizza i dati delle carte di credito.</p>
              <div className="space-y-3">
                {[
                  { t: "Rinnovo automatico", d: "L'abbonamento si rinnova automaticamente alla scadenza del periodo selezionato, salvo disdetta esplicita." },
                  { t: "Cancellazione",       d: "L'utente può cancellare l'abbonamento in qualsiasi momento dal proprio profilo. L'accesso Premium rimane attivo fino alla fine del periodo già pagato." },
                  { t: "Rimborsi",            d: "I rimborsi sono valutati caso per caso entro 14 giorni dall'acquisto, in conformità con la normativa sul diritto di recesso dell'UE." },
                  { t: "Variazioni di prezzo", d: "NorthStar si riserva il diritto di modificare i prezzi, con preavviso di almeno 30 giorni agli abbonati attivi." },
                ].map(({ t, d }) => (
                  <div key={t} className="p-4 rounded-xl border bg-card">
                    <p className="text-sm font-semibold text-foreground mb-1">{t}</p>
                    <p className="text-sm">{d}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="uso" title="Uso consentito e vietato">
              <p>NorthStar è destinato all'uso personale e non commerciale. È espressamente <strong className="text-foreground">vietato</strong>:</p>
              <ul className="space-y-2 pl-4">
                {[
                  "Utilizzare la piattaforma per attività illecite, fraudolente o dannose per terzi.",
                  "Tentare di accedere in modo non autorizzato a sistemi, account o dati altrui.",
                  "Effettuare scraping, reverse engineering o copia sistematica dei contenuti.",
                  "Diffondere contenuti offensivi, discriminatori o in violazione di diritti di terzi.",
                  "Utilizzare strumenti automatizzati (bot, crawler) senza esplicita autorizzazione.",
                  "Rivendere o sublicenziare l'accesso alla piattaforma a terzi.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </Section>

            <Section id="proprieta" title="Proprietà intellettuale">
              <p>Tutti i contenuti presenti su NorthStar — inclusi testi, grafica, struttura della piattaforma, algoritmi e metodologie — sono di proprietà esclusiva di NorthStar o dei rispettivi licenziatari e sono protetti dalle normative vigenti in materia di proprietà intellettuale.</p>
              <p>È consentito l'utilizzo personale e non commerciale dei contenuti. Qualsiasi riproduzione, distribuzione o uso commerciale richiede autorizzazione scritta preventiva.</p>
              <p>I dati inseriti dall'utente (risposte ai test, obiettivi, preferenze) rimangono di proprietà dell'utente. NorthStar si riserva il diritto di utilizzarli in forma anonima e aggregata per migliorare il servizio.</p>
            </Section>

            <Section id="responsabilita" title="Limitazione di responsabilità">
              <p>NorthStar fornisce la piattaforma "così com'è" e "come disponibile". Pur impegnandosi a garantire un servizio affidabile e continuo, non offre garanzie di:</p>
              <ul className="space-y-1.5 pl-4">
                {[
                  "Disponibilità ininterrotta del servizio (manutenzioni, aggiornamenti e interruzioni tecniche sono possibili).",
                  "Accuratezza assoluta dei dati su settori, salari e trend del mercato del lavoro.",
                  "Adeguatezza dei risultati del test a ogni situazione individuale.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <p>NorthStar non è responsabile per decisioni personali, professionali o finanziarie prese sulla base dei contenuti della piattaforma. La responsabilità massima di NorthStar è limitata all'importo pagato dall'utente negli ultimi 12 mesi.</p>
            </Section>

            <Section id="legge" title="Legge applicabile e foro competente">
              <p>I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia relativa all'utilizzo della piattaforma, il foro competente è quello del luogo di residenza o domicilio del consumatore, in conformità con la normativa europea a tutela dei consumatori.</p>
              <p>Prima di procedere per vie legali, NorthStar incoraggia gli utenti a contattare il nostro supporto per una risoluzione amichevole di eventuali dispute.</p>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                <p className="font-medium mb-1">Nota legale</p>
                <p>Questi Termini costituiscono una bozza operativa. Si raccomanda la validazione da parte di un professionista legale prima della pubblicazione definitiva.</p>
              </div>
            </Section>

            {/* CTA */}
            <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 text-center">
              <h2 className="text-xl font-serif font-bold text-foreground mb-2">Domande sui Termini?</h2>
              <p className="text-muted-foreground text-sm mb-5">Siamo qui per rispondere a qualsiasi dubbio sull'utilizzo della piattaforma.</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a href="mailto:info@northstar.app">
                  <Button className="rounded-full">Contattaci <ArrowRight className="w-4 h-4 ml-1.5" /></Button>
                </a>
                <Button asChild variant="outline" className="rounded-full">
                  <Link href="/privacy-policy">Leggi la Privacy Policy</Link>
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
