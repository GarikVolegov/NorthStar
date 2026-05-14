import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

type CompletionResponse = {
  hasTestSession: boolean;
  hasConfirmedSector: boolean;
  hasWorkPreference: boolean;
  hasCv: boolean;
  isPublic: boolean;
  streakDays: number;
  totalObjectives: number;
  completedObjectives: number;
};

const BADGE_DEFS: Array<{
  id: string;
  emoji: string;
  label: string;
  check: (d: CompletionResponse) => boolean;
}> = [
  { id: "test",      emoji: "🧠", label: "Primo test",          check: (d) => d.hasTestSession },
  { id: "sector",    emoji: "🎯", label: "Settore scelto",      check: (d) => d.hasConfirmedSector },
  { id: "cv",        emoji: "📄", label: "CV caricato",         check: (d) => d.hasCv },
  { id: "shared",    emoji: "🌐", label: "Profilo pubblico",    check: (d) => d.isPublic },
  { id: "objectives",emoji: "🏆", label: "5 obiettivi fatti",   check: (d) => d.completedObjectives >= 5 },
  { id: "streak",    emoji: "🔥", label: "Streak 3 giorni",     check: (d) => d.streakDays >= 3 },
];

export function BadgesAchievements({ completionData }: { completionData: CompletionResponse | null }) {
  if (!completionData) return null;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" /> Achievement
          {completionData.streakDays > 0 && (
            <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              <Flame className="w-3 h-3" /> {completionData.streakDays} {completionData.streakDays === 1 ? "giorno" : "giorni"}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {BADGE_DEFS.map((b) => {
            const earned = b.check(completionData);
            return (
              <div
                key={b.id}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-xl border text-xs",
                  earned
                    ? "bg-primary/5 border-primary/20 text-foreground"
                    : "bg-muted/30 border-border text-muted-foreground opacity-40",
                )}
              >
                <span className={cn("text-base", !earned && "grayscale")}>{b.emoji}</span>
                <span className="font-medium leading-tight">{b.label}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
