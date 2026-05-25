export type AppStatus = "saved" | "applied" | "interview" | "offer" | "rejected";

export interface NoteEntry {
  text: string;
  createdAt: string;
}

export interface Application {
  id: number;
  userId: number;
  company: string;
  role: string;
  url: string | null;
  status: AppStatus;
  notes: string | null;
  salary: string | null;
  location: string | null;
  appliedAt: string;
  updatedAt: string;
  notesLog: NoteEntry[] | null;
}

export const STATUS_META: Record<
  AppStatus,
  { label: string; emoji: string; color: string; border: string; bg: string; badge: string }
> = {
  saved: { label: "Salvata", emoji: "💾", color: "text-slate-700", border: "border-l-slate-400", bg: "bg-slate-50", badge: "bg-slate-100 text-slate-700 border-slate-200" },
  applied: { label: "Candidato", emoji: "📤", color: "text-blue-700", border: "border-l-blue-500", bg: "bg-blue-50", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  interview: { label: "Colloquio", emoji: "🎤", color: "text-violet-700", border: "border-l-violet-500", bg: "bg-violet-50", badge: "bg-violet-100 text-violet-700 border-violet-200" },
  offer: { label: "Offerta", emoji: "🎉", color: "text-emerald-700", border: "border-l-emerald-500", bg: "bg-emerald-50", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rifiutato", emoji: "❌", color: "text-rose-700", border: "border-l-rose-400", bg: "bg-rose-50", badge: "bg-rose-100 text-rose-700 border-rose-200" },
};

export const COLUMNS: AppStatus[] = ["saved", "applied", "interview", "offer", "rejected"];

export const EMPTY_FORM = {
  company: "",
  role: "",
  url: "",
  status: "saved" as AppStatus,
  notes: "",
  salary: "",
  location: "",
};

export type ApplicationForm = typeof EMPTY_FORM;
export type ApplicationsResponse = { applications: Application[] };
