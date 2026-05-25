import { Badge } from "@/components/ui/badge";
import { ROADMAP_TEXT } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Award, BookMarked, BookOpen, CheckCircle2, ChevronDown, ChevronUp, Target, Users, Zap } from "lucide-react";
import { useState } from "react";

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

interface PhaseCardProps {
  phase: RoadmapPhase;
  index: number;
  isEditMode: boolean;
  onUpdate: (phaseId: number, updates: Partial<RoadmapPhase>) => void | Promise<void>;
  onCancel: () => void;
}

export function PhaseCard({
  phase,
  index,
  isEditMode,
  onUpdate,
  onCancel,
}: PhaseCardProps) {
  const [expanded, setExpanded] = useState(index === 0);
  const [localTitle, setLocalTitle] = useState(phase.title);
  const [localDescription, setLocalDescription] = useState(phase.description);
  const [localMilestone, setLocalMilestone] = useState(phase.milestone);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(phase.id, {
        title: localTitle,
        description: localDescription,
        milestone: localMilestone,
      });
      // Reset local state to match saved values
      setLocalTitle(phase.title);
      setLocalDescription(phase.description);
      setLocalMilestone(phase.milestone);
    } catch (error) {
      console.error("Failed to save phase:", error);
      // In a real app, you might want to show an error toast
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative">
      <div className="absolute left-[22px] top-[52px] bottom-0 w-px bg-border" />
      <div className="flex gap-4">
        <div className="shrink-0 w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xl z-10 relative">
          {phase.emoji}
        </div>
        <div className="flex-1 pb-8 min-w-0">
          <button onClick={() => setExpanded((v) => !v)} className="w-full text-left">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="flex-1 min-w-0">
               <div className="flex items-center gap-2 flex-wrap">
                 <span className="font-mono text-xs text-muted-foreground">{ROADMAP_TEXT.phaseCard.phaseLabel(phase.id)}</span>
                 <Badge variant="outline" className="text-[10px] px-1.5 py-0">{phase.duration}</Badge>
               </div>
                {isEditMode ? (
                  <>
                    <input
                      type="text"
                      value={localTitle}
                      onChange={(e) => setLocalTitle(e.target.value)}
                      className="border border-input bg-background px-2 py-1 rounded w-full font-semibold text-base"
                      autoFocus
                    />
                  </>
                ) : (
                  <h3 className="font-semibold text-base mt-0.5">{phase.title}</h3>
                )}
              </div>
              <div className="shrink-0 mt-1 text-muted-foreground">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
            {isEditMode ? (
              <>
                <textarea
                  value={localDescription}
                  onChange={(e) => setLocalDescription(e.target.value)}
                  className="border border-input bg-background px-2 py-1 rounded w-full text-sm text-muted-foreground"
                  rows={3}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{phase.description}</p>
            )}
          </button>

          {expanded && (
            <div className="mt-4 space-y-5 animate-in fade-in duration-200">
               <div>
                 <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{ROADMAP_TEXT.phaseCard.sectionTitles.actions}</h4>
                <ul className="space-y-2">
                  {phase.actions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>

               {phase.resources && phase.resources.length > 0 && (
                 <div>
                   <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{ROADMAP_TEXT.phaseCard.sectionTitles.resources}</h4>
                  <div className="flex flex-wrap gap-2">
                    {phase.resources.map((res, i) => (
                      <div
                        key={i}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium",
                          res.type === "corso"
                            ? "bg-blue-50 text-blue-700 border-blue-100"
                            : res.type === "certificazione"
                            ? "bg-violet-50 text-violet-700 border-violet-100"
                            : res.type === "libro"
                            ? "bg-amber-50 text-amber-700 border-amber-100"
                            : res.type === "community"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : "bg-secondary text-secondary-foreground border-border",
                        )}
                      >
                        {res.type === "corso" ? (
                          <BookOpen className="w-3 h-3" />
                        ) : res.type === "certificazione" ? (
                          <Award className="w-3 h-3" />
                        ) : res.type === "libro" ? (
                          <BookMarked className="w-3 h-3" />
                        ) : res.type === "community" ? (
                          <Users className="w-3 h-3" />
                        ) : (
                          <Zap className="w-3 h-3" />
                        )}
                        <span>{res.name}</span>
                        {(res.platform || res.issuer || res.author) && (
                          <span className="opacity-60">· {res.platform ?? res.issuer ?? res.author}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

               <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
                 <div className="flex items-center gap-2 mb-1.5">
                   <Target className="w-4 h-4 text-primary" />
                   <span className="text-xs font-semibold uppercase tracking-wider text-primary">{ROADMAP_TEXT.phaseCard.sectionTitles.milestone}</span>
                 </div>
                {isEditMode ? (
                  <>
                    <input
                      type="text"
                      value={localMilestone}
                      onChange={(e) => setLocalMilestone(e.target.value)}
                      className="border border-input bg-background px-2 py-1 rounded w-full text-sm"
                    />
                  </>
                ) : (
                  <p className="text-sm">{phase.milestone}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Edit controls */}
      {isEditMode && (
        <div className="absolute top-0 right-0 flex space-x-2 mt-2 mr-2">
           <button
             onClick={handleSave}
             disabled={isSaving}
             className={cn(
               "text-xs font-semibold px-3 py-1 rounded",
               isSaving
                 ? "bg-primary text-primary-foreground"
                 : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
             )}
           >
             {isSaving ? ROADMAP_TEXT.phaseCard.buttons.saving : ROADMAP_TEXT.phaseCard.buttons.save}
           </button>
           <button
             onClick={onCancel}
             className="text-xs font-semibold px-3 py-1 rounded bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
           >
             {ROADMAP_TEXT.phaseCard.buttons.cancel}
           </button>
        </div>
      )}
    </div>
  );
}
