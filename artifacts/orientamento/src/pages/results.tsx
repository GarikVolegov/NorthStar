import React from "react";
import { useParams, Link, useLocation } from "wouter";
import { useGetTestSession, useConfirmSector, useGetStatsSummary } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, CheckCircle2, TrendingUp, DollarSign, Activity, Settings2, BarChart3, AlertTriangle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Results() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  
  const { data: session, isLoading, error } = useGetTestSession(id, { 
    query: { enabled: !!id, queryKey: ["testSession", id] } 
  });
  
  const { data: stats } = useGetStatsSummary();
  const confirmSector = useConfirmSector();

  const handleConfirm = (sectorId: number) => {
    confirmSector.mutate({ id, data: { sectorId } }, {
      onSuccess: () => {
        setLocation(`/registra?session=${id}`);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 md:py-24 max-w-5xl">
        <div className="text-center mb-16">
          <Skeleton className="h-10 w-64 mx-auto mb-4" />
          <Skeleton className="h-6 w-full max-w-2xl mx-auto" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full" />
              <CardContent className="p-6">
                <Skeleton className="h-8 w-3/4 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6 mb-6" />
                <Skeleton className="h-10 w-full rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="container mx-auto px-4 py-24 text-center max-w-lg">
        <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-6 opacity-80" />
        <h2 className="text-3xl font-serif font-bold mb-4">Sessione non trovata</h2>
        <p className="text-muted-foreground mb-8">Non siamo riusciti a caricare i risultati di questo test. Potrebbe essere scaduto o l'URL potrebbe essere errato.</p>
        <Button asChild>
          <Link href="/test">Rifai il Test</Link>
        </Button>
      </div>
    );
  }

  const primaryProfile = session.primaryTypes.join(" + ");

  return (
    <div className="container mx-auto px-4 py-12 md:py-20 max-w-6xl">
      
      {/* Profile Header */}
      <div className="text-center mb-16 max-w-3xl mx-auto animate-in slide-in-from-bottom-4 fade-in duration-700">
        <Badge variant="outline" className="mb-6 border-primary/20 text-primary bg-primary/5 px-4 py-1 text-sm rounded-full">
          Il tuo profilo RIASEC
        </Badge>
        <h1 className="text-4xl md:text-6xl font-serif font-bold mb-6 capitalize text-foreground">
          {primaryProfile}
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
          {session.profileSummary}
        </p>
      </div>

      <Separator className="mb-16" />

      {/* Recommendations */}
      <div className="mb-12">
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-center mb-4">
          I tuoi percorsi ideali
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Basandoci sul tuo profilo, ecco i 3 settori in cui potresti eccellere maggiormente. Analizza i dati e scegli la direzione che preferisci.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {session.recommendations.map((rec, index) => (
            <Card 
              key={rec.sectorId} 
              className={cn(
                "flex flex-col border-2 overflow-hidden hover:shadow-xl transition-all duration-300 animate-in slide-in-from-bottom-8 fade-in fill-mode-both",
                rec.matchScore >= 90 ? "border-primary shadow-lg" : "border-border",
              )}
              style={{ animationDelay: `${index * 150}ms` }}
            >
              {rec.matchScore >= 90 && (
                <div className="bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider text-center py-1.5">
                  Miglior Affinità
                </div>
              )}
              
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-4xl">{rec.sector.icon || "💼"}</div>
                  <Badge variant="secondary" className="font-mono font-medium text-sm">
                    {rec.matchScore}% Match
                  </Badge>
                </div>
                <CardTitle className="text-2xl font-serif">{rec.sector.name}</CardTitle>
                <CardDescription className="text-sm line-clamp-2 mt-2">
                  {rec.sector.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <div className="space-y-4">
                  <div className="bg-muted rounded-lg p-3 text-sm flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <p className="text-foreground">{rec.matchReason}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center text-muted-foreground text-xs font-medium uppercase tracking-wider">
                        <DollarSign className="w-3.5 h-3.5 mr-1" /> RAL Media
                      </div>
                      <span className="font-semibold text-sm">
                        €{rec.sector.avgSalaryMin / 1000}k - €{rec.sector.avgSalaryMax / 1000}k
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center text-muted-foreground text-xs font-medium uppercase tracking-wider">
                        <TrendingUp className="w-3.5 h-3.5 mr-1" /> Crescita
                      </div>
                      <span className="font-semibold text-sm text-emerald-600">
                        +{rec.sector.growthRate}% annuo
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center text-muted-foreground text-xs font-medium uppercase tracking-wider">
                        <Activity className="w-3.5 h-3.5 mr-1" /> Trend
                      </div>
                      <span className="font-semibold text-sm capitalize">
                        {rec.sector.trend}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center text-muted-foreground text-xs font-medium uppercase tracking-wider">
                        <Settings2 className="w-3.5 h-3.5 mr-1" /> Rischio Auto.
                      </div>
                      <span className="font-semibold text-sm capitalize">
                        {rec.sector.automationRisk}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="p-6 pt-0 flex flex-col gap-3">
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/settore/${rec.sectorId}`}>Vedi dettagli completi</Link>
                </Button>
                <Button 
                  className="w-full" 
                  onClick={() => handleConfirm(rec.sectorId)}
                  disabled={confirmSector.isPending}
                >
                  Conferma questa direzione
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
      
      {/* Stats Summary snippet if available */}
      {stats && (
        <div className="mt-20 bg-card border rounded-2xl p-8 text-center animate-in fade-in duration-1000 delay-500">
          <BarChart3 className="w-10 h-10 mx-auto text-muted-foreground mb-4 opacity-50" />
          <h3 className="font-serif text-xl font-medium mb-2">Lo sapevi?</h3>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Sei in buona compagnia. Finora <strong className="text-foreground">{stats.totalTestsTaken}</strong> persone hanno completato questo test. 
            I settori più scelti al momento sono: {stats.topSectors.slice(0, 3).map(s => s.name).join(", ")}.
          </p>
        </div>
      )}
      
    </div>
  );
}
