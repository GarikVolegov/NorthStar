import { PhaseCard } from "@/components/roadmap/PhaseCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-fetch";
import { patchJson } from "@/lib/apiClient";
import { ERROR_MESSAGES, ROADMAP_TEXT } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useGetSector } from "@workspace/api-client-react";
import { ArrowLeft, CheckCircle2, Euro, Info, Lightbulb, Loader2, MapPin, Sparkles, Star, TrendingUp, Users, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { fitScoreColor, PathCard, ProsConsBlock, useRotatingMessage } from "./roadmap-components";
import { readRoadmapErrorMessage, readRoadmapSseChunk } from "./roadmap-sse";

const BASE = import.meta.env.BASE_URL || "/";
const ROADMAP_WAITING_MESSAGES = [
  "Sto analizzando il tuo profilo RIASECâ€¦",
  "Confronto laurea, ITS, bootcamp e autodidattaâ€¦",
  "Calcolo i tempi e i costi per ogni percorsoâ€¦",
  "Valuto i pro e i contro su misura per teâ€¦",
  "Identifico le certificazioni piÃ¹ utiliâ€¦",
  "Preparo la tua raccomandazione personalizzataâ€¦",
  "Quasi pronto, ancora qualche secondoâ€¦",
];

interface RoadmapResource {
  type: string;
  name: string;
  platform?: string;
  issuer?: string;
  author?: string;
}

interface RoadmapPhase {
  id: number;
  title: string;
  duration: string;
  emoji: string;
  description: string;
  actions: string[];
  resources: RoadmapResource[];
  milestone: string;
}

interface PathOption {
  id: string;
  type: string;
  title: string;
  shortDescription: string;
  duration: string;
  estimatedCost: string;
  fitScore: number;
  fitReason: string;
  bestFor: string;
  pros: string[];
  cons: string[];
  phases: RoadmapPhase[];
}

interface AlternativeFormativePath {
  title: string;
  type: string;
  duration: string;
  benefit: string;
}

interface SalaryPhase {
  phase: string;
  range: string;
}

interface RoadmapData {
  userProfileSummary: string;
  recommendedPathId: string;
  recommendationReason: string;
  totalDurationBest: string;
  paths: PathOption[];
  alternativeFormativePaths: AlternativeFormativePath[];
  comparison: string;
  salaryProgression: SalaryPhase[];
  topRoles: string[];
  keyTip: string;
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function Roadmap() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { user } = useAuth();

  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const waitingMessage = useRotatingMessage(ROADMAP_WAITING_MESSAGES, 2200, isGenerating);

  const { data: sector, isLoading } = useGetSector(id, {
    query: { enabled: !!id, queryKey: ["sector", id] },
  });

  const sortedPaths = useMemo(
    () => (roadmap ? [...roadmap.paths].sort((a, b) => b.fitScore - a.fitScore) : []),
    [roadmap],
  );
  const selected = useMemo(
    () => roadmap?.paths.find((p) => p.id === selectedPathId) ?? sortedPaths[0] ?? null,
    [roadmap, selectedPathId, sortedPaths],
  );

   async function generateRoadmap() {
     setIsGenerating(true);
     setRoadmap(null);
     setErrorMsg(null);
     setProgress(0);
 
     const progressInterval = setInterval(() => {
       setProgress((p) => Math.min(p + Math.random() * 5, 90));
     }, 400);
 
     try {
       const res = await apiFetch(`${BASE}api/roadmap/${id}/generate`, {
         method: "POST",
         body: JSON.stringify({}),
       });
 
        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as unknown;
          setErrorMsg(readRoadmapErrorMessage(errData) ?? ROADMAP_TEXT.generateState.error.aiUnavailable);
          return;
        }
       const reader = res.body?.getReader();
       if (!reader) throw new Error("Nessun reader");
       const decoder = new TextDecoder();
       let buffer = "";
       let fullText = "";
       let parseErr = false;
 
       while (true) {
         const { done, value } = await reader.read();
         if (done) break;
         buffer += decoder.decode(value, { stream: true });
         const parts = buffer.split("\n\n");
         buffer = parts.pop() ?? "";
         for (const part of parts) {
           if (!part.startsWith("data: ")) continue;
           try {
             const data = readRoadmapSseChunk(part.slice(6));
             if (data.content) fullText += data.content;
             if (data.error) {
               parseErr = true;
               setErrorMsg(data.error);
             }
             if (data.done) {
               const jsonMatch = fullText.match(/\{[\s\S]*\}/);
               if (jsonMatch) {
                 try {
                   const parsed = JSON.parse(jsonMatch[0]) as RoadmapData;
                   setRoadmap(parsed);
                   setSelectedPathId(parsed.recommendedPathId ?? parsed.paths[0]?.id ?? null);
                  } catch {
                    parseErr = true;
                    setErrorMsg(ROADMAP_TEXT.generateState.error.invalidResponse);
                  }
                } else if (!parseErr) {
                  parseErr = true;
                  setErrorMsg(ROADMAP_TEXT.generateState.error.emptyResponse);
                }
             }
           } catch {
             /* ignore malformed sse chunk */
           }
         }
       }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : ROADMAP_TEXT.generateState.error.networkError);
      }
 
     clearInterval(progressInterval);
     setProgress(100);
     setIsGenerating(false);
   }

   const handleUpdatePhase = async (phaseId: number, updates: Partial<RoadmapPhase>) => {
     try {
       await patchJson(`${BASE}api/roadmap/${id}/phases/${phaseId}`, updates);
       
       // Update the roadmap optimistically (will be corrected if API fails)
       if (roadmap && selected) {
         const updatedPaths = roadmap.paths.map(path => {
           if (path.id === selected.id) {
             const updatedPhases = path.phases.map(phase => {
               if (phase.id === phaseId) {
                 return { ...phase, ...updates };
               }
               return phase;
             });
             return { ...path, phases: updatedPhases };
           }
           return path;
         });
         
         setRoadmap(prev => {
           if (!prev) return prev;
           return { ...prev, paths: updatedPaths };
         });
       }
      } catch (error) {
        console.error("Failed to update phase:", error);
        // In a real app, you might want to show an error toast and revert the optimistic update
        setErrorMsg(ERROR_MESSAGES.generic.saveFailed);
      }
   };

   const handleCancelEdit = () => {
     setIsEditMode(false);
   };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary/30" />
      </div>
    );
  }

   if (!user) {
     return (
       <div className="container mx-auto px-4 py-24 max-w-lg text-center">
         <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
           <MapPin className="w-8 h-8 text-primary" />
         </div>
         <h2 className="text-2xl font-serif font-bold mb-3">{ROADMAP_TEXT.auth.title}</h2>
         <p className="text-muted-foreground mb-8">
           {ROADMAP_TEXT.auth.description}
         </p>
         <Button asChild>
           <Link href="/registra">{ROADMAP_TEXT.auth.button}</Link>
         </Button>
       </div>
     );
   }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
       {/* Header */}
       <div className="flex items-center justify-between gap-3 mb-8">
         <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 shrink-0" asChild>
           <Link href={`/settore/${id}`}><ArrowLeft className="w-4 h-4" /></Link>
         </Button>
         <div className="flex-1 min-w-0 flex items-center gap-2">
           <h1 className="font-serif font-bold text-2xl truncate">{ROADMAP_TEXT.header.title}</h1>
           <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/20 text-primary bg-primary/5 shrink-0">
             <Sparkles className="w-2 h-2 mr-1" />{ROADMAP_TEXT.header.premiumBadge}
           </Badge>
         </div>
         {sector && (
           <div className="flex items-center gap-2">
             <p className="text-sm text-muted-foreground">{sector.name}</p>
             {!isGenerating && !isEditMode && (
               <Button
                 variant="ghost"
                 size="icon"
                 onClick={() => setIsEditMode(true)}
                 className="rounded-full h-9 w-9"
               >
                 {isEditMode ? <CheckCircle2 className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
               </Button>
             )}
           </div>
         )}
       </div>

      {/* Generate state */}
       {!roadmap && !isGenerating && (
         <div className="text-center py-16">
           <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
             <MapPin className="w-8 h-8 text-primary" />
           </div>
           <h2 className="text-xl font-serif font-bold mb-3">{ROADMAP_TEXT.generateState.title(sector?.name ?? "")}</h2>
           <p className="text-muted-foreground text-sm max-w-md mx-auto mb-2">
             {ROADMAP_TEXT.generateState.description[0]}
           </p>
           <p className="text-muted-foreground text-xs max-w-md mx-auto mb-8">
             {ROADMAP_TEXT.generateState.description[1]}
           </p>
           <Button size="lg" onClick={generateRoadmap} className="rounded-xl px-8">
             <Sparkles className="w-4 h-4 mr-2" />
             {ROADMAP_TEXT.generateState.button}
           </Button>
           {errorMsg && (
             <p className="text-xs text-destructive mt-4">{errorMsg}</p>
           )}
         </div>
       )}

       {/* Loading state */}
       {isGenerating && (
         <div className="text-center py-16">
           <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
             <Loader2 className="w-8 h-8 text-primary animate-spin" />
           </div>
           <h2 className="text-lg font-semibold mb-2">{ROADMAP_TEXT.loadingState.title}</h2>
           <p key={waitingMessage} className="text-muted-foreground text-sm mb-8 animate-in fade-in duration-500 min-h-[20px]">
             {waitingMessage}
           </p>
           <div className="max-w-xs mx-auto">
             <div className="h-1.5 bg-border rounded-full overflow-hidden">
               <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
             </div>
             <p className="text-xs text-muted-foreground mt-2">{ROADMAP_TEXT.loadingState.progressLabel(progress)}</p>
           </div>
         </div>
       )}

      {/* Roadmap content */}
      {roadmap && (
        <div className="animate-in fade-in duration-500 space-y-10">
           {/* User profile recap */}
           {roadmap.userProfileSummary && (
             <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5">
               <div className="flex items-start gap-3">
                 <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                   <Info className="w-4 h-4 text-primary" />
                 </div>
                 <div className="flex-1">
                   <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">{ROADMAP_TEXT.content.profileSummary.title}</h3>
                   <p className="text-sm leading-relaxed">{roadmap.userProfileSummary}</p>
                 </div>
               </div>
             </div>
           )}

           {/* Path selector */}
           <div>
             <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
               <h2 className="text-lg font-serif font-bold">{ROADMAP_TEXT.content.pathSelector.title}</h2>
               <span className="text-xs text-muted-foreground">{ROADMAP_TEXT.content.pathSelector.alternativesCount(sortedPaths.length)}</span>
             </div>
             <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
               {sortedPaths.map((p) => (
                 <PathCard
                   key={p.id}
                   path={p}
                   isSelected={selected?.id === p.id}
                   isRecommended={p.id === roadmap.recommendedPathId}
                   onClick={() => setSelectedPathId(p.id)}
                 />
               ))}
             </div>
           </div>

           {/* Recommendation reason */}
           {roadmap.recommendationReason && (
             <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-5">
               <div className="flex items-start gap-3">
                 <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                   <Star className="w-4 h-4 text-emerald-700" />
                 </div>
                 <div className="flex-1">
                   <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">
                     {ROADMAP_TEXT.content.recommendationReason.title}
                   </h3>
                   <p className="text-sm leading-relaxed text-emerald-950">{roadmap.recommendationReason}</p>
                 </div>
               </div>
             </div>
           )}

           {/* Selected path details */}
           {selected && (
             <div className="space-y-6">
               <div className="border-t pt-6">
                 <div className="flex items-center gap-2 mb-1">
                   <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{ROADMAP_TEXT.content.selectedPath.title}</span>
                   {selected.id === roadmap.recommendedPathId && (
                     <Badge className="text-[10px] px-1.5 py-0 bg-primary text-primary-foreground">
                       <Star className="w-2.5 h-2.5 mr-0.5" />{ROADMAP_TEXT.content.selectedPath.recommendedBadge}
                     </Badge>
                   )}
                 </div>
                 <h2 className="text-2xl font-serif font-bold mb-1.5">{selected.title}</h2>
                 <p className="text-sm text-muted-foreground mb-4">{selected.shortDescription}</p>
                 <div className="flex flex-wrap gap-3 text-xs">
                   <span className="bg-muted rounded-lg px-2.5 py-1 flex items-center gap-1">
                     <MapPin className="w-3 h-3" /> {selected.duration}
                   </span>
                   <span className="bg-muted rounded-lg px-2.5 py-1 flex items-center gap-1">
                     <Euro className="w-3 h-3" /> {selected.estimatedCost}
                   </span>
                   <span className={cn("rounded-lg px-2.5 py-1 flex items-center gap-1 border", fitScoreColor(selected.fitScore))}>
                     <Sparkles className="w-3 h-3" /> Affinità {selected.fitScore}/100
                   </span>
                 </div>
               </div>

               {/* Fit reason */}
               <div className="bg-card border rounded-2xl p-4">
                 <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{ROADMAP_TEXT.content.selectedPath.fitReason.title}</h4>
                 <p className="text-sm">{selected.fitReason}</p>
                 <p className="text-xs text-muted-foreground mt-2">
                   <span className="font-medium">{ROADMAP_TEXT.content.selectedPath.fitReason.idealProfile}:</span> {selected.bestFor}
                 </p>
               </div>

              {/* Pros / Cons */}
              <ProsConsBlock pros={selected.pros} cons={selected.cons} />

            {/* Phases */}
                {selected.phases && selected.phases.length > 0 && (
                  <div>
                    <h3 className="text-base font-serif font-bold mb-5">{ROADMAP_TEXT.content.phases.title}</h3>
                    <div>
                      {selected.phases.map((phase, i) => (
                        <PhaseCard 
                          key={`${selected.id}-${phase.id}`} 
                          phase={phase} 
                          index={i} 
                          isEditMode={isEditMode}
                          onUpdate={handleUpdatePhase}
                          onCancel={handleCancelEdit}
                        />
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

           {/* Comparison */}
           {roadmap.comparison && (
             <div className="bg-card border rounded-2xl p-5">
               <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                 <TrendingUp className="w-4 h-4 text-primary" />{ROADMAP_TEXT.content.comparison.title}
               </h3>
               <p className="text-sm text-muted-foreground leading-relaxed">{roadmap.comparison}</p>
             </div>
           )}

           {/* Alternative formative paths */}
           {roadmap.alternativeFormativePaths && roadmap.alternativeFormativePaths.length > 0 && (
             <div>
               <h2 className="text-lg font-serif font-bold mb-2">{ROADMAP_TEXT.content.alternativeFormativePaths.title}</h2>
               <p className="text-xs text-muted-foreground mb-4">
                 {ROADMAP_TEXT.content.alternativeFormativePaths.description}
               </p>
               <div className="grid sm:grid-cols-2 gap-3">
                 {roadmap.alternativeFormativePaths.map((alt, i) => (
                   <div key={i} className="bg-card border rounded-xl p-4">
                     <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                       <Badge variant="outline" className="text-[10px] px-1.5 py-0">{alt.type}</Badge>
                       <Badge variant="outline" className="text-[10px] px-1.5 py-0">{alt.duration}</Badge>
                     </div>
                     <h4 className="font-semibold text-sm mb-1">{alt.title}</h4>
                     <p className="text-xs text-muted-foreground">{alt.benefit}</p>
                   </div>
                 ))}
               </div>
             </div>
           )}

           {/* Salary progression */}
           {roadmap.salaryProgression && roadmap.salaryProgression.length > 0 && (
             <div className="bg-card border rounded-2xl p-6">
               <h2 className="text-lg font-serif font-bold mb-5 flex items-center gap-2">
                 <Euro className="w-5 h-5 text-emerald-500" />{ROADMAP_TEXT.content.salaryProgression.title}
               </h2>
               <div className="space-y-4">
                 {roadmap.salaryProgression.map((sp, i) => (
                   <div key={i} className="flex items-center gap-4">
                     <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                     <div className="flex-1 flex justify-between items-center">
                       <span className="text-sm text-muted-foreground">{sp.phase}</span>
                       <span className="font-semibold text-sm">{sp.range}</span>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           )}

           {/* Top roles */}
           {roadmap.topRoles && roadmap.topRoles.length > 0 && (
             <div>
               <h2 className="text-lg font-serif font-bold mb-4 flex items-center gap-2">
                 <Users className="w-5 h-5 text-primary" />{ROADMAP_TEXT.content.topRoles.title}
               </h2>
               <div className="flex flex-wrap gap-2">
                 {roadmap.topRoles.map((role, i) => (
                   <Badge key={i} variant="secondary" className="px-3 py-1.5 text-sm">{role}</Badge>
                 ))}
               </div>
             </div>
           )}

           {/* Key tip */}
           {roadmap.keyTip && (
             <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6">
               <div className="flex items-center gap-2 mb-3">
                 <Lightbulb className="w-5 h-5 text-amber-600" />
                 <h3 className="font-semibold text-amber-800">{ROADMAP_TEXT.content.keyTip.title}</h3>
               </div>
               <p className="text-sm text-amber-900 leading-relaxed">{roadmap.keyTip}</p>
             </div>
           )}

           {/* Regenerate */}
           <div className="text-center pt-4 pb-8">
             <Button variant="outline" onClick={generateRoadmap} className="rounded-xl">
               <TrendingUp className="w-4 h-4 mr-2" />
               {ROADMAP_TEXT.content.regenerateButton}
             </Button>
           </div>
        </div>
      )}
    </div>
  );
}
