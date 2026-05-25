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
        "bg-background rounded-xl border border-l-4 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing",
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
            className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0 -mt-0.5 -mr-0.5 group"
            disabled={deleting}
          >
            {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3 opacity-0 group-hover:opacity-100" />}
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
      <div className="flex items-center gap-1.5 px-3 pb-2.5 pt-0">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1 mr-auto">
          <Calendar className="w-2.5 h-2.5" />{formatDate(app.appliedAt)}
        </span>

        {app.url && (
          <a href={app.url} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors" title="Apri offerta">
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onCoverLetter(); }}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-violet-600 transition-colors"
          title="Genera lettera di presentazione AI"
        >
          <Sparkles className="w-3 h-3" />
        </button>

        {/* Notes toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setNotesOpen((o) => !o); }}
          className={cn(
            "flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md transition-colors",
            notesOpen
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
          title={notesOpen ? "Chiudi diario" : "Apri diario note"}
        >
          <StickyNote className="w-3 h-3" />
          {notesLog.length > 0 ? notesLog.length : ""}
          {notesOpen ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
        </button>

        {/* Status dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button onClick={(e) => e.stopPropagation()}
              className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 hover:opacity-80 transition-opacity", meta.badge)}>
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
                    className="opacity-0 group-hover/note:opacity-100 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0"
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
              className="flex-1 min-w-0 text-xs bg-muted/60 border border-input rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 transition-shadow"
            />
            <button
              onClick={submitNote}
              disabled={!noteInput.trim() || addNoteMutation.isPending}
              className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              title="Aggiungi nota (Invio)"
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
