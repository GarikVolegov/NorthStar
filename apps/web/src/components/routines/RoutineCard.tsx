import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ROUTINE_TYPE_EMOJI, ROUTINE_TYPE_LABEL, type UserRoutine } from "@/hooks/useRoutines";
import { Trash2 } from "lucide-react";
import { useState } from "react";

function scheduleToLabel(schedule: string): string {
  const presets: Record<string, string> = {
    daily:           "Ogni giorno",
    ogni_giorno:     "Ogni giorno",
    weekly:          "Ogni settimana",
    settimanale:     "Ogni settimana",
    every_2_days:    "Ogni 2 giorni",
    every_monday:    "Ogni lunedì",
    every_tuesday:   "Ogni martedì",
    every_wednesday: "Ogni mercoledì",
    every_thursday:  "Ogni giovedì",
    every_friday:    "Ogni venerdì",
    every_saturday:  "Ogni sabato",
    every_sunday:    "Ogni domenica",
  };
  const preset = presets[schedule];
  if (preset) return preset;
  const parts = schedule.split(" ");
  if (parts.length === 5) {
    const hour = parts[1] ?? "";
    const dow  = parts[4] ?? "";
    const DAYS: string[] = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
    const idx = parseInt(dow);
    const dayName = DAYS[idx] ?? dow;
    if (dow !== "*" && hour !== "*") return `${dayName} alle ${hour}:00`;
    if (hour !== "*") return `Ogni giorno alle ${hour}:00`;
  }
  return schedule;
}

function formatDate(dateStr: string | null, fallback: string): string {
  if (!dateStr) return fallback;
  return new Intl.DateTimeFormat("it-IT", {
    day:    "2-digit",
    month:  "short",
    hour:   "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

const OUTPUT_CHANNEL_LABEL: Record<string, string> = {
  email:         "Email",
  in_app:        "In-app",
  wendy_context: "Wendy",
  all:           "Tutti i canali",
};

interface RoutineCardProps {
  routine:        UserRoutine;
  onToggleActive: (id: number, active: boolean) => void;
  onDelete:       (id: number) => void;
}

export function RoutineCard({ routine, onToggleActive, onDelete }: RoutineCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const emoji = ROUTINE_TYPE_EMOJI[routine.type] ?? "🤖";
  const typeLabel = ROUTINE_TYPE_LABEL[routine.type] ?? routine.type;
  const displayName = routine.name ?? typeLabel;

  function handleDeleteClick() {
    if (confirmDelete) {
      onDelete(routine.id);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl" aria-hidden="true">{emoji}</span>
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{displayName}</p>
            {routine.name && (
              <p className="text-xs text-muted-foreground">{typeLabel}</p>
            )}
          </div>
        </div>
        <Switch
          checked={routine.active}
          onCheckedChange={(checked) => onToggleActive(routine.id, checked)}
          aria-label={routine.active ? "Disattiva routine" : "Attiva routine"}
        />
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="text-xs">
          {scheduleToLabel(routine.schedule)}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {OUTPUT_CHANNEL_LABEL[routine.outputChannel] ?? routine.outputChannel}
        </Badge>
        {!routine.active && (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            In pausa
          </Badge>
        )}
      </div>

      {/* Run info */}
      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
        <div>
          <span className="font-medium text-foreground/70">Prossima:</span>{" "}
          {formatDate(routine.nextRunAt, "—")}
        </div>
        <div>
          <span className="font-medium text-foreground/70">Ultima:</span>{" "}
          {formatDate(routine.lastRunAt, "Mai eseguita")}
        </div>
      </div>

      {/* Delete */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className={confirmDelete ? "text-destructive hover:text-destructive" : "text-muted-foreground"}
          onClick={handleDeleteClick}
          onBlur={() => setConfirmDelete(false)}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          {confirmDelete ? "Conferma eliminazione" : "Elimina"}
        </Button>
      </div>
    </div>
  );
}
