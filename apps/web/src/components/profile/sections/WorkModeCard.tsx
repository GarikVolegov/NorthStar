import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, CheckCircle2 } from "lucide-react";
import { WorkModeSelector, useWorkPreference } from "@/components/WorkModeSelector";
import type { WorkPreference } from "@/components/WorkModeSelector";

export function WorkModeCard({ userId }: { userId: number }) {
  const { workPreference, save, isLoading } = useWorkPreference(userId);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();

  const LABELS: Record<string, string> = {
    dipendente: "Dipendente",
    autonomo: "Autonomo / Freelance",
    ibrido: "Ibrido",
    unknown: "Non definita",
  };

  const handleSelect = async (mode: WorkPreference) => {
    await save(mode);
    queryClient.invalidateQueries({ queryKey: ["latest-recommendations"] });
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" /> Modalità di lavoro preferita
          </CardTitle>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-primary hover:underline font-medium"
            >
              Modifica
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {saved && (
          <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium mb-3 animate-in fade-in duration-300">
            <CheckCircle2 className="w-4 h-4" /> Preferenza salvata!
          </div>
        )}
        {!editing ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{LABELS[workPreference] ?? workPreference}</p>
              <p className="text-xs text-muted-foreground">
                {workPreference === "unknown"
                  ? "Non hai ancora definito una preferenza di lavoro."
                  : "La tua preferenza influenza il ranking dei settori consigliati."}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <WorkModeSelector
              initialValue={workPreference !== "unknown" ? workPreference : undefined}
              onSelect={handleSelect}
              isPending={isLoading}
            />
            <button
              onClick={() => setEditing(false)}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground"
            >
              Annulla
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
