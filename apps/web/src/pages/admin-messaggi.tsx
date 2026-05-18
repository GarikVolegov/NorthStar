import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  MessageCircle, Mail, CheckCheck, RefreshCw, LogOut,
  Eye, Filter, ChevronDown, ChevronUp, Inbox, Circle,
  ShieldAlert,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { AdminAuthGate } from "@/components/AdminAuthGate";

const BASE = import.meta.env.BASE_URL || "/";

const SUBJECTS: Record<string, string> = {
  info:      "Informazioni",
  supporto:  "Supporto",
  premium:   "Pagamenti",
  privacy:   "Privacy",
  feedback:  "Feedback",
  altro:     "Altro",
};

const SUBJECT_COLORS: Record<string, string> = {
  info:      "bg-blue-100 text-blue-700",
  supporto:  "bg-orange-100 text-orange-700",
  premium:   "bg-yellow-100 text-yellow-700",
  privacy:   "bg-emerald-100 text-emerald-700",
  feedback:  "bg-purple-100 text-purple-700",
  altro:     "bg-slate-100 text-slate-700",
};

type Message = {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  read: boolean;
  createdAt: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminMessaggi() {
  useEffect(() => {
    document.title = "Admin Messaggi â€” NorthStar";
  }, []);

  const { key, logout } = useAdminAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterRead, setFilterRead] = useState<"all" | "unread" | "read">("all");
  const [search, setSearch] = useState("");

  const fetchMessages = useCallback(async (adminKey: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE}api/contact/messages`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      if (!res.ok) throw new Error("Errore caricamento");
      const data: Message[] = await res.json();
      setMessages(data);
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (key) fetchMessages(key);
  }, [key, fetchMessages]);

  async function markRead(id: number) {
    await fetch(`${BASE}api/contact/messages/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${key}` },
    });
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, read: true } : m));
  }

  const filtered = messages.filter((m) => {
    if (filterSubject !== "all" && m.subject !== filterSubject) return false;
    if (filterRead === "unread" && m.read) return false;
    if (filterRead === "read" && !m.read) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!m.name.toLowerCase().includes(s) && !m.email.toLowerCase().includes(s) && !m.message.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const unreadCount = messages.filter((m) => !m.read).length;
  const totalCount = messages.length;

  const subjectCounts = Object.keys(SUBJECTS).reduce<Record<string, number>>((acc, k) => {
    acc[k] = messages.filter((m) => m.subject === k).length;
    return acc;
  }, {});

  return (
    <AdminAuthGate title="Admin Messaggi" description="Gestisci i messaggi di contatto degli utenti">
      <div className="min-h-screen bg-slate-50/50">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="container mx-auto px-4 max-w-5xl flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Inbox className="w-4 h-4 text-primary" />
            </div>
            <span className="font-serif font-bold text-foreground">Admin Â· Messaggi</span>
            {unreadCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount} nuovi
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-full gap-1.5" onClick={() => fetchMessages(key)} disabled={loading}>
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              Aggiorna
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full gap-1.5 text-muted-foreground" onClick={logout}>
              <LogOut className="w-3.5 h-3.5" />
              Esci
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-5xl py-8 space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Totali", value: totalCount, color: "text-foreground" },
            { label: "Non letti", value: unreadCount, color: "text-primary" },
            { label: "Letti", value: totalCount - unreadCount, color: "text-emerald-600" },
            { label: "Mostrati", value: filtered.length, color: "text-muted-foreground" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border bg-card p-4 text-center">
              <p className={cn("text-2xl font-bold font-serif", s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <Filter className="w-4 h-4" />
            Filtri
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Subject filter */}
            <button
              onClick={() => setFilterSubject("all")}
              className={cn("px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors",
                filterSubject === "all" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}
            >
              Tutti ({totalCount})
            </button>
            {Object.entries(SUBJECTS).map(([k, label]) => (
              subjectCounts[k] > 0 && (
                <button
                  key={k}
                  onClick={() => setFilterSubject(k)}
                  className={cn("px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors",
                    filterSubject === k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}
                >
                  {label} ({subjectCounts[k]})
                </button>
              )
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1 border-t">
            {(["all", "unread", "read"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilterRead(v)}
                className={cn("px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors",
                  filterRead === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}
              >
                {v === "all" ? "Tutti" : v === "unread" ? "Non letti" : "Letti"}
              </button>
            ))}
            <div className="ml-auto">
              <Input
                placeholder="Cerca nome, email, testoâ€¦"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-xs rounded-xl w-52"
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3">{error}</p>
        )}

        {/* Messages list */}
        {loading && messages.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 opacity-40" />
            Caricamento messaggiâ€¦
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nessun messaggio trovato</p>
            <p className="text-sm mt-1">Prova a cambiare i filtri</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "rounded-2xl border bg-card overflow-hidden transition-all",
                  !msg.read && "border-primary/30 shadow-sm"
                )}
              >
                {/* Message header */}
                <div className="flex items-start gap-3 p-4">
                  {/* Unread dot */}
                  <div className="pt-1 shrink-0">
                    {msg.read
                      ? <Circle className="w-3 h-3 text-muted-foreground/30 fill-muted-foreground/10" />
                      : <Circle className="w-3 h-3 text-primary fill-primary" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-foreground">{msg.name}</span>
                      <a href={`mailto:${msg.email}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {msg.email}
                      </a>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", SUBJECT_COLORS[msg.subject] ?? SUBJECT_COLORS["altro"])}>
                        {SUBJECTS[msg.subject] ?? msg.subject}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{fmtDate(msg.createdAt)}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!msg.read && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full text-xs gap-1.5"
                        onClick={() => markRead(msg.id)}
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Segna letto
                      </Button>
                    )}
                    <button
                      onClick={() => setExpanded(expanded === msg.id ? null : msg.id)}
                      className="w-8 h-8 rounded-xl border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                    >
                      {expanded === msg.id
                        ? <ChevronUp className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />
                      }
                    </button>
                  </div>
                </div>

                {/* Expanded body */}
                {expanded === msg.id && (
                  <div className="border-t bg-muted/30 px-5 py-4">
                    <div className="flex items-start gap-2 text-xs text-muted-foreground mb-3">
                      <Eye className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>Messaggio completo</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                    <div className="mt-4 pt-3 border-t flex items-center gap-3">
                      <a
                        href={`mailto:${msg.email}?subject=Re: ${SUBJECTS[msg.subject] ?? msg.subject} â€” NorthStar`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Rispondi via email
                      </a>
                      {!msg.read && (
                        <button
                          onClick={() => markRead(msg.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:underline"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          Segna come letto
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </AdminAuthGate>
  );
}
