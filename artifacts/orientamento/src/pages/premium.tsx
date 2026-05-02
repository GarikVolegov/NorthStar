import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Sparkles, Brain, Network, Zap, Clock, ArrowRight, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const features = [
  {
    icon: <Brain className="w-5 h-5 text-primary" />,
    title: "Wiki Personalizzata con AI",
    description: "Accedi a una knowledge base intelligente che risponde alle tue domande specifiche sul settore scelto.",
  },
  {
    icon: <Network className="w-5 h-5 text-primary" />,
    title: "Grafo della Conoscenza",
    description: "Visualizza percorsi formativi, competenze e connessioni tra ruoli professionali in modo interattivo.",
  },
  {
    icon: <Zap className="w-5 h-5 text-primary" />,
    title: "Roadmap Dettagliata",
    description: "Ricevi un piano step-by-step personalizzato per entrare nel tuo settore ideale nei tempi stimati.",
  },
  {
    icon: <Sparkles className="w-5 h-5 text-primary" />,
    title: "Aggiornamenti in Tempo Reale",
    description: "Dati di mercato aggiornati, offerte di lavoro e trend del settore sempre freschi.",
  },
];

const PLAN_MONTHLY_PRICE = 9;
const PLAN_YEARLY_PRICE = 90;

type BillingInterval = "month" | "year";

export default function Premium() {
  const { user } = useAuth();
  const [billing, setBilling] = useState<BillingInterval>("month");
  const [email, setEmail] = useState(user?.email ?? "");
  const [joined, setJoined] = useState(false);

  function handleWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setJoined(true);
  }

  const price = billing === "month" ? PLAN_MONTHLY_PRICE : PLAN_YEARLY_PRICE;
  const perMonth = billing === "year" ? (PLAN_YEARLY_PRICE / 12).toFixed(2) : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-5xl">

        {/* Header */}
        <div className="text-center mb-16 max-w-2xl mx-auto animate-in slide-in-from-bottom-4 fade-in duration-700">
          <Badge variant="outline" className="mb-6 border-primary/20 text-primary bg-primary/5 px-4 py-1 text-sm rounded-full">
            NorthStar Premium
          </Badge>
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6 text-foreground">
            Sblocca il tuo pieno potenziale
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Vai oltre il test gratuito. Con Premium ottieni strumenti avanzati per trasformare le tue inclinazioni in un percorso professionale concreto.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {features.map((f, i) => (
            <div
              key={i}
              className="flex gap-4 p-6 bg-card border rounded-2xl hover:shadow-md transition-shadow duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                {f.icon}
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            </div>
          ))}
        </div>

        <Separator className="mb-12" />

        {/* Billing Toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center bg-muted rounded-full p-1 gap-1">
            <button
              onClick={() => setBilling("month")}
              className={cn(
                "px-6 py-2 rounded-full text-sm font-medium transition-all duration-200",
                billing === "month"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Mensile
            </button>
            <button
              onClick={() => setBilling("year")}
              className={cn(
                "px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2",
                billing === "year"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Annuale
              <Badge variant="secondary" className="text-xs py-0 px-2 bg-emerald-100 text-emerald-700 border-0">
                -17%
              </Badge>
            </button>
          </div>
        </div>

        {/* Pricing Card */}
        <div className="max-w-sm mx-auto">
          <Card className="border-2 border-primary rounded-3xl shadow-xl overflow-hidden">
            <div className="bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider text-center py-2">
              Più Popolare
            </div>

            <CardHeader className="text-center pb-4 pt-8">
              <CardTitle className="text-2xl font-serif">Piano Premium</CardTitle>
              <CardDescription>Accesso completo a tutte le funzionalità</CardDescription>
            </CardHeader>

            <CardContent className="text-center pb-6">
              <div className="mb-6">
                <div className="text-5xl font-bold text-foreground mb-1">
                  €{price}
                  <span className="text-lg font-normal text-muted-foreground">
                    /{billing === "month" ? "mese" : "anno"}
                  </span>
                </div>
                {perMonth && (
                  <p className="text-sm text-emerald-600 font-medium mt-1">
                    Equivale a €{perMonth}/mese · Risparmi il 17%
                  </p>
                )}
              </div>

              <ul className="space-y-3 text-left mb-8">
                {[
                  "Wiki AI personalizzata",
                  "Grafo della conoscenza",
                  "Roadmap step-by-step",
                  "Dati di mercato live",
                  "Supporto prioritario",
                  "Obiettivi illimitati",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {/* Waitlist section */}
              {joined ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-emerald-800">Sei in lista!</p>
                  <p className="text-xs text-emerald-700 mt-1">
                    Ti contatteremo appena il pagamento sarà disponibile.
                  </p>
                </div>
              ) : (
                <div className="bg-muted/60 rounded-2xl p-5">
                  <div className="flex items-center gap-2 justify-center mb-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">Pagamenti in arrivo</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                    Il sistema di pagamento è in fase di attivazione. Lascia la tua email e ti avvisiamo non appena sarà disponibile.
                  </p>
                  <form onSubmit={handleWaitlist} className="flex flex-col gap-2">
                    <Input
                      type="email"
                      placeholder="La tua email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="rounded-xl text-sm h-9"
                    />
                    <Button type="submit" className="w-full rounded-xl h-10">
                      <Bell className="w-4 h-4 mr-2" /> Avvisami quando è pronto
                    </Button>
                  </form>
                </div>
              )}
            </CardContent>

            <CardFooter className="pb-6 px-6 justify-center">
              <p className="text-xs text-muted-foreground text-center">
                Nessun addebito ora · Annulla in qualsiasi momento
              </p>
            </CardFooter>
          </Card>
        </div>

        {/* FAQ / trust signals */}
        <div className="mt-16 grid md:grid-cols-3 gap-6 text-center">
          {[
            { title: "Sicuro al 100%", body: "Pagamento gestito tramite Stripe, lo standard di settore per i pagamenti online." },
            { title: "Annulla quando vuoi", body: "Nessun vincolo. Puoi disdire l'abbonamento in qualsiasi momento dal tuo profilo." },
            { title: "Supporto dedicato", body: "I membri Premium hanno accesso prioritario al nostro team di supporto." },
          ].map((item) => (
            <div key={item.title} className="p-6 bg-card border rounded-2xl">
              <h4 className="font-semibold text-foreground mb-2 text-sm">{item.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
