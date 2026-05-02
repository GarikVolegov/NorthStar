import React from "react";
import { useParams, Link } from "wouter";
import { useGetSector, useGetSectorStats } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Clock, DollarSign, ShieldAlert, Sparkles, TrendingUp, Target, Plus, Minus, Zap, Brain, MapPin, Network, ArrowRight, Newspaper } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function Sector() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);

  const { data: sector, isLoading: isLoadingSector, error: sectorError } = useGetSector(id, {
    query: { enabled: !!id, queryKey: ["sector", id] }
  });

  const { data: stats, isLoading: isLoadingStats } = useGetSectorStats(id, {
    query: { enabled: !!id, queryKey: ["sectorStats", id] }
  });

  if (isLoadingSector) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <Skeleton className="h-8 w-24 mb-8" />
        <div className="flex gap-6 mb-12">
          <Skeleton className="h-24 w-24 rounded-2xl" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (sectorError || !sector) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-bold mb-4">Settore non trovato</h2>
        <Button asChild variant="outline">
          <Link href="/">Torna alla home</Link>
        </Button>
      </div>
    );
  }

  // Prepare chart data if stats exist
  const chartData = stats ? [
    { name: "Breve Termine", value: parseInt(stats.growthProjection.shortTerm), color: "hsl(var(--chart-1))" },
    { name: "Medio Termine", value: parseInt(stats.growthProjection.midTerm), color: "hsl(var(--chart-2))" },
    { name: "Lungo Termine", value: parseInt(stats.growthProjection.longTerm), color: "hsl(var(--chart-3))" }
  ] : [];

  return (
    <div className="container mx-auto px-4 py-8 md:py-16 max-w-5xl">
      <Button asChild variant="ghost" size="sm" className="mb-8 rounded-full">
        <button onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Torna ai risultati
        </button>
      </Button>

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start mb-12">
        <div className="w-24 h-24 md:w-32 md:h-32 bg-primary/10 rounded-3xl flex items-center justify-center text-5xl md:text-6xl shrink-0 shadow-inner">
          {sector.icon}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap gap-2 mb-4">
            {sector.riasecTypes.map(type => (
              <Badge key={type} variant="secondary" className="font-mono bg-secondary/50 hover:bg-secondary/70">
                {type}
              </Badge>
            ))}
            <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">
              <TrendingUp className="w-3 h-3 mr-1" /> {sector.trend}
            </Badge>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4 leading-tight">
            {sector.name}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            {sector.description}
          </p>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-16">
        <div className="bg-card border rounded-2xl p-5 flex flex-col justify-center">
          <div className="flex items-center text-muted-foreground text-sm font-medium mb-2 uppercase tracking-wider">
            <DollarSign className="w-4 h-4 mr-1.5" /> RAL Media
          </div>
          <div className="text-xl md:text-2xl font-semibold">
            €{sector.avgSalaryMin / 1000}k - {sector.avgSalaryMax / 1000}k
          </div>
        </div>
        <div className="bg-card border rounded-2xl p-5 flex flex-col justify-center">
          <div className="flex items-center text-muted-foreground text-sm font-medium mb-2 uppercase tracking-wider">
            <TrendingUp className="w-4 h-4 mr-1.5" /> Crescita
          </div>
          <div className="text-xl md:text-2xl font-semibold text-emerald-600">
            +{sector.growthRate}% annuo
          </div>
        </div>
        <div className="bg-card border rounded-2xl p-5 flex flex-col justify-center">
          <div className="flex items-center text-muted-foreground text-sm font-medium mb-2 uppercase tracking-wider">
            <Clock className="w-4 h-4 mr-1.5" /> Tempo Formazione
          </div>
          <div className="text-xl md:text-2xl font-semibold capitalize">
            {sector.timeToAutonomy}
          </div>
        </div>
        <div className="bg-card border rounded-2xl p-5 flex flex-col justify-center">
          <div className="flex items-center text-muted-foreground text-sm font-medium mb-2 uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 mr-1.5" /> Rischio Autom.
          </div>
          <div className="text-xl md:text-2xl font-semibold capitalize">
            {sector.automationRisk}
          </div>
        </div>
      </div>

      {/* Premium Feature Cards */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-5">
          <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5 text-xs">
            <Sparkles className="w-3 h-3 mr-1" /> Strumenti Premium
          </Badge>
          <span className="text-sm text-muted-foreground">Approfondisci con l'AI</span>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <Link href={`/wiki/${id}`} className="block">
            <div className="h-full p-5 bg-card border rounded-2xl hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors">
                <Brain className="w-5 h-5 text-indigo-600" />
              </div>
              <h4 className="font-semibold mb-1.5 text-sm">Wiki AI</h4>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Fai domande specifiche sul settore e ricevi risposte personalizzate dall'AI.
              </p>
              <div className="flex items-center text-indigo-600 text-xs font-medium">
                Apri la chat <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Link>

          <Link href={`/roadmap/${id}`} className="block">
            <div className="h-full p-5 bg-card border rounded-2xl hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
                <MapPin className="w-5 h-5 text-emerald-600" />
              </div>
              <h4 className="font-semibold mb-1.5 text-sm">Roadmap Dettagliata</h4>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Piano step-by-step generato dall'AI per entrare nel settore con risorse concrete.
              </p>
              <div className="flex items-center text-emerald-600 text-xs font-medium">
                Genera il piano <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Link>

          <Link href={`/grafo/${id}`} className="block">
            <div className="h-full p-5 bg-card border rounded-2xl hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
              <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center mb-4 group-hover:bg-violet-100 transition-colors">
                <Network className="w-5 h-5 text-violet-600" />
              </div>
              <h4 className="font-semibold mb-1.5 text-sm">Grafo della Conoscenza</h4>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Visualizza ruoli, competenze e strumenti del settore in un grafo interattivo.
              </p>
              <div className="flex items-center text-violet-600 text-xs font-medium">
                Esplora il grafo <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Deep Dive Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full flex justify-start border-b rounded-none h-auto bg-transparent p-0 mb-8 space-x-6 overflow-x-auto">
          <TabsTrigger 
            value="overview" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3 text-base"
          >
            Panoramica
          </TabsTrigger>
          <TabsTrigger 
            value="skills" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3 text-base"
          >
            Competenze
          </TabsTrigger>
          <TabsTrigger 
            value="data" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3 text-base"
          >
            Dati & Trend
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-10 animate-in fade-in duration-500">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-xl font-serif font-bold flex items-center">
                <Plus className="w-5 h-5 mr-2 text-emerald-500" /> Vantaggi
              </h3>
              <ul className="space-y-4">
                {sector.advantages.map((adv, i) => (
                  <li key={i} className="flex items-start">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 mr-3 shrink-0" />
                    <span className="text-muted-foreground leading-relaxed">{adv}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-6">
              <h3 className="text-xl font-serif font-bold flex items-center">
                <Minus className="w-5 h-5 mr-2 text-amber-500" /> Svantaggi
              </h3>
              <ul className="space-y-4">
                {sector.disadvantages.map((dis, i) => (
                  <li key={i} className="flex items-start">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 mr-3 shrink-0" />
                    <span className="text-muted-foreground leading-relaxed">{dis}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-primary/5 rounded-3xl p-8 border border-primary/10">
            <h3 className="text-xl font-serif font-bold flex items-center mb-6">
              <Sparkles className="w-5 h-5 mr-2 text-primary" /> Opportunità Future
            </h3>
            <ul className="grid md:grid-cols-2 gap-6">
              {sector.opportunities.map((opp, i) => (
                <li key={i} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-background border shadow-sm flex items-center justify-center shrink-0 font-mono text-xs font-bold text-primary">
                    {i+1}
                  </div>
                  <span className="text-muted-foreground leading-relaxed">{opp}</span>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="skills" className="animate-in fade-in duration-500">
          <div className="max-w-3xl">
            <h3 className="text-2xl font-serif font-bold mb-6 flex items-center">
              <Target className="w-6 h-6 mr-3 text-primary" /> Competenze Chiave
            </h3>
            <p className="text-muted-foreground mb-8 text-lg">
              Per eccellere in questo settore, dovrai sviluppare questo set di competenze. Non preoccuparti se non le possiedi tutte ora, {sector.timeToAutonomy} è il tempo stimato per acquisirle.
            </p>
            <div className="flex flex-wrap gap-3">
              {sector.skills.map((skill, i) => (
                <div key={i} className="px-5 py-3 bg-card border rounded-xl shadow-sm text-foreground font-medium flex items-center">
                  <Zap className="w-4 h-4 mr-2 text-amber-500 opacity-70" /> {skill}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="data" className="animate-in fade-in duration-500">
          {isLoadingStats ? (
            <Skeleton className="h-[400px] w-full rounded-3xl" />
          ) : stats ? (
            <div className="grid md:grid-cols-5 gap-8">
              <div className="md:col-span-3 bg-card border rounded-3xl p-6 md:p-8 shadow-sm">
                <h3 className="text-xl font-serif font-bold mb-8">Proiezione di Crescita del Settore</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        tickFormatter={(value) => `+${value}%`}
                      />
                      <Tooltip 
                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                        contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: 'var(--shadow-md)' }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="md:col-span-2 space-y-6">
                <div className="bg-card border rounded-3xl p-6 shadow-sm">
                  <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-4">Statistiche della Piattaforma</h4>
                  <div className="space-y-6">
                    <div>
                      <div className="text-3xl font-serif font-bold text-foreground mb-1">{stats.timesPicked}</div>
                      <div className="text-sm text-muted-foreground">Volte scelto dagli utenti</div>
                    </div>
                    <Separator />
                    <div>
                      <div className="text-3xl font-serif font-bold text-foreground mb-1">{stats.avgMatchScore}%</div>
                      <div className="text-sm text-muted-foreground">Affinità media</div>
                    </div>
                  </div>
                </div>
                <div className="bg-primary text-primary-foreground rounded-3xl p-6 shadow-md">
                  <h4 className="font-serif font-bold text-lg mb-2">Pronto a iniziare?</h4>
                  <p className="text-primary-foreground/80 text-sm mb-6">
                    Se questo settore risuona con te, confermalo nei tuoi risultati per ricevere una roadmap dettagliata.
                  </p>
                  <Button variant="secondary" className="w-full" asChild>
                    <button onClick={() => window.history.back()}>Torna e conferma</button>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Dati statistici non disponibili al momento.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
