import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, Brain, Lightbulb, AlertCircle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersonalityInsight } from "@/hooks/useAIAgents";
import { cn } from "@/lib/utils";

interface Props {
  riasecScores: Record<string, number> | null | undefined;
  spiritScores?: Record<string, number> | null | undefined;
  primaryTypes: string[] | null | undefined;
  isPremium?: boolean;
}

export function PersonalityInsightCard({ riasecScores, spiritScores, primaryTypes, isPremium = false }: Props) {
  const { data, isLoading, isError } = usePersonalityInsight({
    riasecScores,
    spiritScores,
    primaryTypes,
    enabled: true,
  });

  if (!riasecScores || !primaryTypes?.length) return null;

  return (
    <AnimatePresence mode="wait">
      {isLoading && (
        <motion.div
          key="loading"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mb-10"
        >
          <Card className="border-violet-200/60 bg-gradient-to-br from-violet-50/60 to-background">
            <CardContent className="flex items-center gap-4 py-8">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                <Loader2 className="w-5 h-5 text-violet-600 animate-spin" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Analisi AI in corso…</p>
                <p className="text-sm text-muted-foreground">Il modello sta elaborando il tuo profilo unico</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {isError && null}

      {data && !isLoading && (
        <motion.div
          key="insight"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-10"
        >
          <Card className="border-violet-200/60 bg-gradient-to-br from-violet-50/40 via-background to-indigo-50/30 overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-foreground">
                      Insight AI · Profilo Profondo
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Analisi personalizzata generata dall'intelligenza artificiale</p>
                  </div>
                </div>
                <Badge variant="outline" className="border-violet-200 text-violet-700 bg-violet-50 text-xs gap-1">
                  <Sparkles className="w-3 h-3" />
                  {isPremium ? "Premium AI" : "AI"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Headline */}
              <div className="bg-white/60 rounded-xl border border-violet-100 px-5 py-4">
                <p className="text-xl font-serif font-bold text-foreground leading-snug">
                  "{data.headline}"
                </p>
              </div>

              {/* Narrative */}
              <div className="flex gap-3">
                <div className="shrink-0 mt-1">
                  <Brain className="w-4 h-4 text-violet-500" />
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                  {data.narrative}
                </p>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                {/* Unique value */}
                <div className="bg-emerald-50/70 rounded-xl border border-emerald-100 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-emerald-600" />
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Valore unico</p>
                  </div>
                  <p className="text-sm text-foreground/80">{data.unique_value}</p>
                </div>

                {/* Shadow side */}
                <div className="bg-amber-50/70 rounded-xl border border-amber-100 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">L'ombra</p>
                  </div>
                  <p className="text-sm text-foreground/80">{data.shadow_side}</p>
                </div>

                {/* Growth path */}
                <div className="bg-blue-50/70 rounded-xl border border-blue-100 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Percorso crescita</p>
                  </div>
                  <p className="text-sm text-foreground/80">{data.growth_path}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
