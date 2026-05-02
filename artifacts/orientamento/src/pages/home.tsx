import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Compass, LogIn, MapPin, Sparkles, Star, TrendingUp, Users } from "lucide-react";
import { useGetStatsSummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginDialog } from "@/components/auth/LoginDialog";
import { useAuth } from "@/contexts/AuthContext";

function AnimatedNumber({ value, suffix = "" }: { value: number, suffix?: string }) {
  const [current, setCurrent] = useState(0);
  
  useEffect(() => {
    let startTime: number;
    const duration = 1500;
    
    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      // easeOutQuart
      const ease = 1 - Math.pow(1 - progress, 4);
      setCurrent(Math.floor(ease * value));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value]);

  return <span>{current}{suffix}</span>;
}

export default function Home() {
  const { data: stats, isLoading: isStatsLoading } = useGetStatsSummary();
  const { isLoggedIn, user } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative w-full py-20 md:py-32 overflow-hidden flex items-center justify-center min-h-[90vh]">
        <div className="absolute inset-0 z-0">
          <img 
            src="/hero.png" 
            alt="Serene path in nature" 
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px]"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background"></div>
        </div>
        
        <div className="container mx-auto px-4 md:px-6 relative z-10 flex flex-col items-center text-center max-w-4xl">
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm text-primary mb-8 animate-in slide-in-from-bottom-4 fade-in duration-700">
            <Star className="mr-2 h-4 w-4 fill-primary" />
            <span>Scopri il tuo potenziale</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-serif font-bold tracking-tight text-foreground mb-6 animate-in slide-in-from-bottom-6 fade-in duration-700 delay-150 fill-mode-both leading-[1.1]">
            Trova la tua strada,<br />
            <span className="text-primary italic">con consapevolezza.</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl animate-in slide-in-from-bottom-8 fade-in duration-700 delay-300 fill-mode-both leading-relaxed font-light">
            NorthStar non ti dice cosa fare. Ti offre una bussola per esplorare i settori che risuonano con la tua natura, guidandoti verso una scelta autentica.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto animate-in slide-in-from-bottom-10 fade-in duration-700 delay-500 fill-mode-both">
            <Button asChild size="lg" className="rounded-full text-base h-14 px-8 shadow-xl">
              <Link href="/test">
                Inizia il Test Gratuito <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            {isLoggedIn ? (
              <Button asChild size="lg" variant="outline" className="rounded-full text-base h-14 px-8 border-primary/20 bg-background/50 backdrop-blur">
                <Link href="/risultati/latest">Rivedi i tuoi risultati</Link>
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                className="rounded-full text-base h-14 px-8 border-primary/20 bg-background/50 backdrop-blur"
                onClick={() => setLoginOpen(true)}
              >
                <LogIn className="mr-2 h-5 w-5" />
                Hai già un account? Accedi
              </Button>
            )}
          </div>
          {isLoggedIn && user && (
            <p className="mt-4 text-sm text-muted-foreground animate-in fade-in duration-500">
              Bentornato, <span className="font-medium text-primary">{user.name}</span> ✦
            </p>
          )}
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-card border-y">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 divide-y md:divide-y-0 md:divide-x divide-border">
            <div className="flex flex-col items-center text-center pt-8 md:pt-0">
              <div className="text-4xl md:text-5xl font-serif font-bold text-primary mb-2">
                {isStatsLoading ? <Skeleton className="h-12 w-24 rounded-md" /> : <AnimatedNumber value={stats?.totalTestsTaken || 12450} />}
              </div>
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Persone guidate</p>
            </div>
            <div className="flex flex-col items-center text-center pt-8 md:pt-0">
              <div className="text-4xl md:text-5xl font-serif font-bold text-primary mb-2">
                {isStatsLoading ? <Skeleton className="h-12 w-24 rounded-md" /> : <AnimatedNumber value={stats?.totalSectors || 42} />}
              </div>
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Settori analizzati</p>
            </div>
            <div className="flex flex-col items-center text-center pt-8 md:pt-0">
              <div className="text-4xl md:text-5xl font-serif font-bold text-primary mb-2">
                {isStatsLoading ? <Skeleton className="h-12 w-24 rounded-md" /> : <AnimatedNumber value={stats?.avgGrowthRate || 15} suffix="%" />}
              </div>
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Crescita media settori</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="come-funziona" className="py-24 bg-background">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">Un percorso in tre passi</h2>
            <p className="text-lg text-muted-foreground">Il nostro approccio è basato sul modello RIASEC, validato scientificamente, unito a dati di mercato in tempo reale.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-px bg-border -z-10" />
            
            <div className="flex flex-col items-center text-center group">
              <div className="w-24 h-24 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center mb-6 shadow-sm group-hover:scale-105 transition-transform duration-300">
                <Users className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-bold font-serif mb-3">1. Chi sei</h3>
              <p className="text-muted-foreground leading-relaxed">
                Rispondi a 12 semplici domande basate su attitudini e preferenze. Non ci sono risposte giuste o sbagliate, solo la tua verità.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center group">
              <div className="w-24 h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6 shadow-sm group-hover:scale-105 transition-transform duration-300">
                <Compass className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-bold font-serif mb-3">2. La mappa</h3>
              <p className="text-muted-foreground leading-relaxed">
                Scopri il tuo profilo RIASEC e ricevi 3 raccomandazioni di settori professionali in linea con la tua natura.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center group">
              <div className="w-24 h-24 rounded-full bg-accent text-accent-foreground flex items-center justify-center mb-6 shadow-sm group-hover:scale-105 transition-transform duration-300">
                <MapPin className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-bold font-serif mb-3">3. La direzione</h3>
              <p className="text-muted-foreground leading-relaxed">
                Esplora dati reali: stipendi, prospettive di crescita e rischio di automazione. Scegli la tua strada e registra il tuo percorso.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial / Philosophy */}
      <section className="py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <Compass className="h-12 w-12 mx-auto mb-8 opacity-80" />
            <blockquote className="text-2xl md:text-4xl font-serif font-medium leading-relaxed mb-8">
              "Il futuro non si indovina, si costruisce. La migliore carriera non è quella che paga di più in assoluto, ma quella in cui il tuo talento naturale incontra una reale opportunità di mercato."
            </blockquote>
            <p className="text-primary-foreground/80 font-medium tracking-wider uppercase text-sm">
              La Filosofia di NorthStar
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 md:px-6">
          <div className="bg-card rounded-3xl p-8 md:p-16 text-center border shadow-xl max-w-5xl mx-auto relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              <TrendingUp className="w-64 h-64" />
            </div>
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-serif font-bold text-foreground mb-6">
                Pronto a scoprire la tua direzione?
              </h2>
              <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto font-light">
                Il test richiede meno di 3 minuti. Senza registrazione obbligatoria.
              </p>
              <Button asChild size="lg" className="rounded-full text-lg h-14 px-10 shadow-lg hover:shadow-xl transition-all">
                <Link href="/test">Inizia Ora</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
}
