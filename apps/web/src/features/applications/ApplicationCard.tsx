import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteJson, postJson } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, ChevronDown, ChevronUp, Clock, DollarSign, ExternalLink, Loader2, MapPin, Send, Sparkles, StickyNote, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import { useTranslation } from "react-i18next";

import { useFormatDate, useFormatNoteDate } from "./applicationDates";
import { COLUMNS, STATUS_META, type Application, type AppStatus, type NoteEntry } from "./applicationTypes";

const BASE = import.meta.env.BASE_URL || "/";

export function AppCard({
  app, userId, onEdit, onDelete, onStatusChange, deleting,
  isDragging, onDragStart, onDragEnd, onCoverLetter,
}: {
  app: Application;
  userId: number;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (s: AppStatus) => void;
  deleting: boolean;
  isDragging: boolean;
  onDragStart: (e: ReactDragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onCoverLetter: () => void;
}) {
  const { t } = useTranslation();
  const formatDate = useFormatDate();
  const formatNoteDate = useFormatNoteDate();
  const queryClient = useQueryClient();
  const meta = STATUS_META[app.status];
  const otherStatuses = COLUMNS.filter((s) => s !== app.status);
  const notesLog: NoteEntry[] = Array.isArray(app.notesLog) ? app.notesLog : [];

  const [notesOpen, setNotesOpen] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (notesOpen) inputRef.current?.focus();
  }, [notesOpen]);

  const addNoteMutation = useMutation({
    mutationFn: async (text: string) => {
      return postJson<Application>(`${BASE}api/applications/${app.id}/notes`, {
        text,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications", userId] });
      setNoteInput("");
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (index: number) => {
      await deleteJson(`${BASE}api/applications/${app.id}/notes/${index}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications", userId] }),
  });

  function submitNote() {
    const text = noteInput.trim();
    if (!text || addNoteMutation.isPending) return;
    addNoteMutation.mutate(text);
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group bg-background rounded-xl border border-l-4 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing",
        meta.border,
        isDragging && "opacity-50 scale-[0.97]",
      )}
    >
      {/* ── Clickable card body ── */}
      <div className="p-3 cursor-pointer" onClick={onEdit}>
        {/* Company + Delete */}
        <div className="flex items-start gap-1.5 mb-1">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground leading-tight truncate">{app.company}</p>
            <p className="text-xs text-muted-foreground truncate">{app.role}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100"
            disabled={deleting}
            aria-label={`Elimina candidatura ${app.company}`}
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Location / Salary */}
        {(app.location || app.salary) && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
            {app.location && (
              <span className="text-[11px] flex items-center gap-1 text-muted-foreground">
                <MapPin className="w-2.5 h-2.5" />{app.location}
              </span>
            )}
            {app.salary && (
              <span className="text-[11px] flex items-center gap-1 text-muted-foreground">
                <DollarSign className="w-2.5 h-2.5" />{app.salary}
              </span>
            )}
          </div>
        )}

        {/* Notes preview */}
        {app.notes && (
          <p className="text-[11px] text-muted-foreground italic mt-1.5 line-clamp-2">{app.notes}</p>
        )}

        {/* Latest diary note teaser (when panel is closed) */}
        {!notesOpen && notesLog.length > 0 && (
          <div className="mt-2 flex items-start gap-1.5">
            <Clock className="w-2.5 h-2.5 text-muted-foreground/60 mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground/70 line-clamp-1 italic">
              {formatNoteDate(notesLog[0]!.createdAt)} · {notesLog[0]!.text}
            </p>
          </div>
        )}
      </div>

      {/* ── Footer: date, url, notes toggle, status ── */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2.5 pt-0">
        <span className="flex min-w-0 basis-full items-center gap-1 text-[11px] text-muted-foreground">
          <Calendar className="w-2.5 h-2.5" />{formatDate(app.appliedAt)}
        </span>

        {app.url && (
          <a href={app.url} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
            title="Apri offerta"
            aria-label={`Apri offerta ${app.company}`}>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onCoverLetter(); }}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-violet-600"
          title="Genera lettera di presentazione AI"
          aria-label={`Genera lettera di presentazione per ${app.company}`}
        >
          <Sparkles className="w-3 h-3" />
        </button>

        {/* Notes toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setNotesOpen((o) => !o); }}
          className={cn(
            "flex h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors",
            notesOpen
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
          title={notesOpen ? "Chiudi diario" : "Apri diario note"}
          aria-label={notesOpen ? `Chiudi diario note ${app.company}` : `Apri diario note ${app.company}`}
        >
          <StickyNote className="w-3 h-3" />
          {notesLog.length > 0 ? notesLog.length : ""}
          {notesOpen ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
        </button>

        {/* Status dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button onClick={(e) => e.stopPropagation()}
              className={cn("flex min-h-11 items-center gap-1 rounded-full border px-3 text-[11px] font-semibold transition-opacity hover:opacity-80", meta.badge)}
              aria-label={`Cambia stato candidatura ${app.company}: ${meta.label}`}>
              {meta.emoji} {meta.label} <ChevronDown className="w-2.5 h-2.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {otherStatuses.map((s) => {
              const m = STATUS_META[s];
              return (
                <DropdownMenuItem key={s} onClick={(e) => { e.stopPropagation(); onStatusChange(s); }}
                  className="text-xs gap-2 cursor-pointer">
                  <span>{m.emoji}</span> {t("candidature.moveTo", { status: t(`candidature.status.${s}`) })}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Inline notes diary ── */}
      {notesOpen && (
        <div
          className="border-t border-border/60 mx-3 pb-3 pt-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Existing notes */}
          {notesLog.length > 0 && (
            <div className="space-y-1.5 mb-2.5 max-h-40 overflow-y-auto pr-1">
              {notesLog.map((entry, i) => (
                <div key={i} className="flex items-start gap-2 group/note">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap pt-0.5 shrink-0 tabular-nums">
                    {formatNoteDate(entry.createdAt)}
                  </span>
                  <p className="text-[11px] text-foreground leading-relaxed flex-1 min-w-0">{entry.text}</p>
                  <button
                    onClick={() => deleteNoteMutation.mutate(i)}
                    disabled={deleteNoteMutation.isPending}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover/note:opacity-100"
                    aria-label={`Elimina nota ${i + 1}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {notesLog.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic mb-2.5">
              {t("candidature.noNotesYet")}
            </p>
          )}

          {/* Add note input */}
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitNote(); }
              }}
              placeholder={t("candidature.addNotePlaceholder")}
              className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-muted/60 px-3 text-xs transition-shadow placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={submitNote}
              disabled={!noteInput.trim() || addNoteMutation.isPending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              title="Aggiungi nota (Invio)"
              aria-label="Aggiungi nota"
            >
              {addNoteMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
