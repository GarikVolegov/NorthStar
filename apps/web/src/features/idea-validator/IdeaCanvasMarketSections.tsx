import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Archive, BrainCircuit, Compass, Copy, LineChart, Plus } from "lucide-react";
import { InfoHint } from "./InfoHint";
import { CANVAS_FIELDS, FIELD_HELP } from "./ideaValidatorConfig";
import type { CanvasKey, CompetitorEntry, MarketInsight } from "./ideaValidatorTypes";

export function IdeaCanvasSection({
  visibleCanvasKeys,
  canvas,
  averageScore,
  updateCanvas,
  askWendy,
}: {
  visibleCanvasKeys: CanvasKey[];
  canvas: Record<CanvasKey, string>;
  averageScore: number;
  updateCanvas: (key: CanvasKey, value: string) => void;
  askWendy: (focus: string) => void;
}) {
  return (
    <section className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="grid gap-3 md:grid-cols-2">
        {CANVAS_FIELDS.filter(({ key }) => visibleCanvasKeys.includes(key)).map(({ key, title, icon: Icon, placeholder, questions }) => (
          <div key={key} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              {FIELD_HELP[key] ? <InfoHint title={title} {...FIELD_HELP[key]} /> : null}
            </div>
            <ul className="mb-3 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
              {(questions ?? []).map((question) => (
                <li key={question} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                  <span>{question}</span>
                </li>
              ))}
            </ul>
            <Textarea
              value={canvas[key]}
              onChange={(event) => updateCanvas(key, event.target.value)}
              placeholder={placeholder}
              className="min-h-32 resize-none"
            />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Prontezza idea
            </p>
            <p className="mt-1 text-3xl font-bold text-foreground">{averageScore}%</p>
          </div>
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
            <Compass className="h-8 w-8 text-primary" />
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Wendy userà questi dati come riferimento quando le chiedi di analizzare l'idea.
        </p>
        <Button
          className="mt-4 min-h-11 w-full rounded-full gap-2"
          onClick={() => askWendy("Analizza l'idea e dimmi i prossimi 3 passi")}
        >
          <BrainCircuit className="h-4 w-4" />
          Chiedi analisi a Wendy
        </Button>
      </div>
    </section>
  );
}

export function MarketCompetitorsSection({
  market,
  competitors,
  activeCompetitor,
  updateMarket,
  addCompetitor,
  setActiveCompetitorId,
  duplicateActiveCompetitor,
  removeActiveCompetitor,
  updateActiveCompetitor,
  askWendy,
}: {
  market: MarketInsight;
  competitors: CompetitorEntry[];
  activeCompetitor: CompetitorEntry | null;
  updateMarket: (key: keyof MarketInsight, value: string) => void;
  addCompetitor: () => void;
  setActiveCompetitorId: (id: string) => void;
  duplicateActiveCompetitor: () => void;
  removeActiveCompetitor: () => void;
  updateActiveCompetitor: (key: keyof CompetitorEntry, value: string) => void;
  askWendy: (focus: string) => void;
}) {
  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LineChart className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Competitor e mercato</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Raccogli alternative reali, posizionamento, prezzi e opportunità prima di investire sull'idea.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 rounded-full gap-2"
          onClick={() =>
            askWendy(
              "Interpreta la sezione Competitor e mercato. Usa alternativa attuale, prezzo/posizionamento, punti forti/deboli, opportunita e competitor inseriti. Dimmi quali segnali sono forti, quali mancano e quale verifica fare dopo.",
            )
          }
        >
          <BrainCircuit className="h-4 w-4" />
          Interpreta mercato
        </Button>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-2">
        <MarketField label="Alternativa attuale" value={market.currentAlternative} onChange={(value) => updateMarket("currentAlternative", value)} placeholder="Cosa usano oggi gli utenti al posto della tua soluzione?" />
        <MarketField label="Prezzo e posizionamento" value={market.pricingPositioning} onChange={(value) => updateMarket("pricingPositioning", value)} placeholder="Che prezzo, modello o fascia di mercato sembrano realistici?" />
        <MarketField label="Punti forti/deboli" value={market.strengthsWeaknesses} onChange={(value) => updateMarket("strengthsWeaknesses", value)} placeholder="Dove il mercato e forte? Dove lascia scoperti gli utenti?" />
        <MarketField label="Opportunita" value={market.opportunities} onChange={(value) => updateMarket("opportunities", value)} placeholder="Quale spazio specifico puoi occupare meglio degli altri?" />
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[320px_1fr]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Competitor
              </p>
              <p className="text-sm text-muted-foreground">
                {competitors.length} {competitors.length === 1 ? "competitor" : "competitor"}
              </p>
            </div>
            <Button type="button" size="sm" className="min-h-11 rounded-full gap-2" onClick={addCompetitor}>
              <Plus className="h-4 w-4" />
              Aggiungi
            </Button>
          </div>

          {competitors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-background/40 p-4">
              <p className="text-sm font-semibold text-foreground">
                Aggiungi il primo competitor o alternativa
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Anche un foglio Excel, un consulente o un processo manuale possono essere competitor reali.
              </p>
              <Button type="button" className="mt-4 min-h-11 rounded-full gap-2" onClick={addCompetitor}>
                <Plus className="h-4 w-4" />
                Primo competitor
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {competitors.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveCompetitorId(item.id)}
                  className={`min-h-16 w-full rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    item.id === activeCompetitor?.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background/40 hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-semibold text-foreground">
                      {item.name || "Competitor senza nome"}
                    </span>
                    {item.price ? (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                        {item.price}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {item.positioning || item.opportunity || "Posizionamento da definire"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {activeCompetitor ? (
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Competitor selezionato
                </p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">
                  {activeCompetitor.name || "Competitor senza nome"}
                </h3>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" className="min-h-11 rounded-full gap-2" onClick={duplicateActiveCompetitor}>
                  <Copy className="h-4 w-4" />
                  Duplica
                </Button>
                <Button type="button" variant="outline" className="min-h-11 rounded-full gap-2" onClick={removeActiveCompetitor}>
                  <Archive className="h-4 w-4" />
                  Rimuovi
                </Button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <CompetitorInput label="Nome" value={activeCompetitor.name} onChange={(value) => updateActiveCompetitor("name", value)} />
              <CompetitorInput label="URL opzionale" value={activeCompetitor.url} onChange={(value) => updateActiveCompetitor("url", value)} placeholder="https://..." input />
              <CompetitorInput label="Posizionamento" value={activeCompetitor.positioning} onChange={(value) => updateActiveCompetitor("positioning", value)} placeholder="A chi parla, quale promessa fa, come si presenta?" />
              <CompetitorInput label="Prezzo" value={activeCompetitor.price} onChange={(value) => updateActiveCompetitor("price", value)} placeholder="Gratis, abbonamento, setup fee, consulenza, fascia prezzo..." />
              <CompetitorInput label="Punti forti" value={activeCompetitor.strengths} onChange={(value) => updateActiveCompetitor("strengths", value)} placeholder="Cosa fa bene questo competitor?" />
              <CompetitorInput label="Punti deboli" value={activeCompetitor.weaknesses} onChange={(value) => updateActiveCompetitor("weaknesses", value)} placeholder="Dove lascia frizione, costi, lacune o insoddisfazione?" />
              <div className="md:col-span-2">
                <CompetitorInput label="Opportunita per NorthStar" value={activeCompetitor.opportunity} onChange={(value) => updateActiveCompetitor("opportunity", value)} placeholder="Quale spazio puoi occupare meglio rispetto a questo competitor?" />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MarketField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-28 resize-none" />
    </div>
  );
}

function CompetitorInput({
  label,
  value,
  onChange,
  placeholder,
  input = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  input?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {input ? (
        <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-11" />
      ) : (
        <Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-28 resize-none" />
      )}
    </div>
  );
}
