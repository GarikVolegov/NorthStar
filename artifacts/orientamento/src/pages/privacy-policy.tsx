import { useEffect } from "react";
import { Link } from "wouter";
import { Shield, Mail, ArrowRight } from "lucide-react";
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
      <div className="prose-like space-y-3 text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

const TOC = [
  { id: "titolare",      label: "Titolare del trattamento" },
  { id: "dati",          label: "Tipologie di dati raccolti" },
  { id: "finalita",      label: "Finalità e basi giuridiche" },
  { id: "cookie",        label: "Cookie e tecnologie simili" },
  { id: "conservazione", label: "Modalità e tempi di conservazione" },
  { id: "destinatari",   label: "Destinatari dei dati" },
  { id: "diritti",       label: "Diritti dell'utente" },
  { id: "aggiornamenti", label: "Aggiornamenti della policy" },
];

export default function PrivacyPolicy() {
  useSeo(
    "Privacy Policy — NorthStar",
    "Leggi la Privacy Policy di NorthStar: come raccogliamo, utilizziamo e proteggiamo i tuoi dati personali nel rispetto del GDPR."
  );

  return (
    <div className="min-h-screen">

      {/* Header */}
      <section className="border-b bg-gradient-to-b from-muted/40 to-background py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-4 py-1.5 text-sm font-medium mb-5">
            <Shield className="w-4 h-4" />
            Trasparenza e protezione dei dati
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground text-lg leading-relaxed mb-3">
            Questa policy descrive come NorthStar raccoglie, utilizza e protegge i dati personali degli utenti che accedono alla piattaforma.
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

            <Section id="titolare" title="Titolare del trattamento">
              <p>Il titolare del trattamento dei dati personali è <strong className="text-foreground">NorthStar</strong>, raggiungibile all'indirizzo email dedicato alla privacy.</p>
              <p>Per qualsiasi richiesta relativa al trattamento dei tuoi dati puoi contattarci a: <a href="mailto:privacy@northstar.app" className="text-primary hover:underline font-medium">privacy@northstar.app</a></p>
            </Section>

            <Section id="dati" title="Tipologie di dati raccolti">
              <p>NorthStar raccoglie esclusivamente i dati necessari al funzionamento del servizio:</p>
              <ul className="space-y-2 pl-4">
                {[
                  "Dati di registrazione: nome, indirizzo email, password cifrata.",
                  "Risposte ai test di orientamento (RIASEC e Cinque Spiriti) e i relativi risultati.",
                  "Preferenze salvate: settori preferiti, articoli salvati, obiettivi di carriera.",
                  "Dati tecnici e di utilizzo: indirizzo IP, tipo di browser, pagine visitate, data e ora di accesso.",
                  "Dati di pagamento: gestiti in modo sicuro da Stripe; NorthStar non memorizza i dati della carta.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </Section>

            <Section id="finalita" title="Finalità e basi giuridiche">
              <p>Trattiamo i tuoi dati per le seguenti finalità:</p>
              <div className="space-y-3">
                {[
                  { base: "Esecuzione del contratto", desc: "Fornitura del servizio, gestione dell'account, salvataggio dei risultati e delle preferenze." },
                  { base: "Interesse legittimo",      desc: "Miglioramento della piattaforma, sicurezza informatica, prevenzione delle frodi." },
                  { base: "Consenso",                 desc: "Invio di comunicazioni di marketing e newsletter, se esplicitamente autorizzato dall'utente." },
                  { base: "Obbligo legale",           desc: "Conservazione dei dati contabili e fiscali nei casi previsti dalla normativa." },
                ].map(({ base, desc }) => (
                  <div key={base} className="p-4 rounded-xl border bg-card">
                    <p className="text-sm font-semibold text-foreground mb-1">{base}</p>
                    <p className="text-sm">{desc}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="cookie" title="Cookie e tecnologie simili">
              <p>NorthStar utilizza cookie tecnici necessari al funzionamento della piattaforma (sessione, autenticazione, preferenze UI). Non utilizziamo cookie di profilazione di terze parti.</p>
              <p>I cookie tecnici non richiedono consenso. Puoi gestire le impostazioni dei cookie dal tuo browser in qualsiasi momento.</p>
              <div className="p-4 rounded-xl bg-muted/50 border text-sm">
                <p className="font-medium text-foreground mb-1">Cookie utilizzati</p>
                <p>Cookie di sessione (autenticazione), cookie di preferenza UI (tema, lingua). Nessun cookie di tracciamento o marketing di terze parti.</p>
              </div>
            </Section>

            <Section id="conservazione" title="Modalità e tempi di conservazione">
              <p>I dati personali sono trattati con misure di sicurezza adeguate (cifratura, accesso controllato, backup regolari) e conservati per i tempi strettamente necessari:</p>
              <ul className="space-y-2 pl-4">
                {[
                  "Dati dell'account: fino alla cancellazione dell'account da parte dell'utente.",
                  "Risultati dei test: conservati per tutta la durata dell'account, eliminati su richiesta.",
                  "Dati di pagamento: secondo le policy di Stripe e gli obblighi fiscali vigenti.",
                  "Log tecnici: conservati per un massimo di 90 giorni.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </Section>

            <Section id="destinatari" title="Destinatari dei dati">
              <p>I dati personali possono essere comunicati a terzi solo nei seguenti casi:</p>
              <ul className="space-y-2 pl-4">
                {[
                  "Fornitori di servizi tecnici (hosting, database, CDN) vincolati da accordi di riservatezza.",
                  "Stripe, per la gestione sicura dei pagamenti.",
                  "Autorità competenti, se richiesto dalla legge.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <p>I dati non vengono venduti né ceduti a terzi per finalità commerciali.</p>
            </Section>

            <Section id="diritti" title="Diritti dell'utente">
              <p>Ai sensi del GDPR (Reg. UE 2016/679), hai il diritto di:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { right: "Accesso",        desc: "Ottenere copia dei tuoi dati personali." },
                  { right: "Rettifica",      desc: "Correggere dati inesatti o incompleti." },
                  { right: "Cancellazione",  desc: "Richiedere la cancellazione dei tuoi dati." },
                  { right: "Limitazione",    desc: "Limitare il trattamento in determinate circostanze." },
                  { right: "Portabilità",    desc: "Ricevere i dati in formato strutturato e leggibile." },
                  { right: "Opposizione",    desc: "Opporti al trattamento per interessi legittimi o marketing." },
                ].map(({ right, desc }) => (
                  <div key={right} className="p-3 rounded-xl border bg-card">
                    <p className="text-sm font-semibold text-foreground">{right}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
              <p>Per esercitare i tuoi diritti, scrivi a <a href="mailto:privacy@northstar.app" className="text-primary hover:underline font-medium">privacy@northstar.app</a>. Hai anche il diritto di presentare reclamo al Garante per la Protezione dei Dati Personali.</p>
            </Section>

            <Section id="aggiornamenti" title="Aggiornamenti della policy">
              <p>Questa Privacy Policy può essere aggiornata periodicamente per riflettere cambiamenti normativi o del servizio. Le modifiche significative verranno comunicate via email agli utenti registrati.</p>
              <p>La versione aggiornata sarà sempre disponibile a questa pagina con la data di ultimo aggiornamento indicata in cima.</p>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                <p className="font-medium mb-1">Nota legale</p>
                <p>Questa policy è una bozza operativa. Si raccomanda la validazione da parte di un professionista legale specializzato in privacy e GDPR prima della pubblicazione definitiva.</p>
              </div>
            </Section>

            {/* CTA */}
            <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 text-center">
              <Mail className="w-10 h-10 text-primary mx-auto mb-3 opacity-80" />
              <h2 className="text-xl font-serif font-bold text-foreground mb-2">Hai domande sulla privacy?</h2>
              <p className="text-muted-foreground text-sm mb-5">Siamo disponibili per qualsiasi chiarimento sul trattamento dei tuoi dati personali.</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a href="mailto:privacy@northstar.app">
                  <Button className="rounded-full">Contattaci <ArrowRight className="w-4 h-4 ml-1.5" /></Button>
                </a>
                <Button asChild variant="outline" className="rounded-full">
                  <Link href="/termini-di-servizio">Leggi i Termini di servizio</Link>
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
