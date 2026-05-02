import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Sparkles, Brain, Network, Zap, Lock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL || "/";

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

type BillingInterval = "month" | "year";

interface Price {
  id: string;
  unitAmount: number;
  currency: string;
  recurring: { interval: string };
}

interface Product {
  id: string;
  name: string;
  description: string;
  prices: Price[];
}

export default function Premium() {
  const [billing, setBilling] = useState<BillingInterval>("month");
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    fetch(`${BASE}api/stripe/products`)
      .then(r => r.json())
      .then(d => {
        setProducts(d.data || []);
        setLoadingProducts(false);
      })
      .catch(() => {
        setError("Impossibile caricare i piani. Riprova tra qualche minuto.");
        setLoadingProducts(false);
      });
  }, []);

  const handleCheckout = async (priceId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BASE}api/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("Errore durante la creazione del checkout. Riprova.");
    } finally {
      setIsLoading(false);
    }
  };

  const getPriceForInterval = (product: Product): Price | undefined =>
    product.prices.find(p => p.recurring?.interval === billing);

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
    }).format(amount / 100);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-5xl">

        {/* Header */}
        <div className="text-center mb-16 max-w-2xl mx-auto animate-in slide-in-from-bottom-4 fade-in duration-700">
          <Badge variant="outline" className="mb-6 border-primary/20 text-primary bg-primary/5 px-4 py-1 text-sm rounded-full">
            Orientamento Premium
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

        {/* Pricing Cards */}
        {error && (
          <div className="text-center text-destructive mb-8 p-4 bg-destructive/10 rounded-xl">
            {error}
          </div>
        )}

        {loadingProducts ? (
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {[0, 1].map(i => (
              <div key={i} className="h-80 bg-muted rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
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
                <div className="text-5xl font-bold text-foreground mb-1">
                  {billing === "month" ? "€9" : "€90"}
                  <span className="text-lg font-normal text-muted-foreground">
                    /{billing === "month" ? "mese" : "anno"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2 mb-6">
                  {billing === "year" ? "Equivale a €7,50/mese" : "Fatturazione mensile"}
                </p>
                <ul className="space-y-3 text-left">
                  {["Wiki AI personalizzata", "Grafo della conoscenza", "Roadmap step-by-step", "Dati di mercato live", "Supporto prioritario"].map(item => (
                    <li key={item} className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="pb-8 px-6">
                <Button className="w-full h-12 rounded-xl text-base" disabled>
                  <Lock className="w-4 h-4 mr-2" /> Piani in arrivo
                </Button>
              </CardFooter>
            </Card>
          </div>
        ) : (
          <div className={cn(
            "grid gap-6 max-w-4xl mx-auto",
            products.length === 1 ? "max-w-sm" : "md:grid-cols-2"
          )}>
            {products.map((product, idx) => {
              const price = getPriceForInterval(product);
              const isFeatured = idx === 0;
              return (
                <Card
                  key={product.id}
                  className={cn(
                    "rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-xl",
                    isFeatured ? "border-2 border-primary shadow-lg" : "border"
                  )}
                >
                  {isFeatured && (
                    <div className="bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider text-center py-2">
                      Più Popolare
                    </div>
                  )}
                  <CardHeader className="text-center pb-4 pt-8">
                    <CardTitle className="text-2xl font-serif">{product.name}</CardTitle>
                    <CardDescription>{product.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-center pb-6">
                    {price ? (
                      <div className="mb-6">
                        <div className="text-5xl font-bold text-foreground mb-1">
                          {formatPrice(price.unitAmount, price.currency)}
                          <span className="text-lg font-normal text-muted-foreground">
                            /{billing === "month" ? "mese" : "anno"}
                          </span>
                        </div>
                        {billing === "year" && (
                          <p className="text-sm text-emerald-600 font-medium">
                            Risparmi il 17% rispetto al mensile
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground mb-6">
                        Piano {billing === "month" ? "mensile" : "annuale"} non disponibile
                      </p>
                    )}
                    <ul className="space-y-3 text-left">
                      {["Wiki AI personalizzata", "Grafo della conoscenza", "Roadmap step-by-step", "Dati di mercato live", "Supporto prioritario"].map(item => (
                        <li key={item} className="flex items-center gap-3 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter className="pb-8 px-6">
                    <Button
                      className="w-full h-12 rounded-xl text-base"
                      onClick={() => price && handleCheckout(price.id)}
                      disabled={!price || isLoading}
                    >
                      {isLoading ? "Preparazione checkout..." : "Inizia ora"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {/* Trust Footer */}
        <p className="text-center text-sm text-muted-foreground mt-10">
          Pagamento sicuro tramite Stripe · Annulla in qualsiasi momento · Nessun vincolo
        </p>

      </div>
    </div>
  );
}
