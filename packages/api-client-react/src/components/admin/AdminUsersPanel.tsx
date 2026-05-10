/**
 * AdminUsersPanel — Student Directory
 *
 * - Lista paginata utenti con ricerca real-time (debounced 300ms)
 * - Colonne: Avatar, Nome, Email, Mode, Journey, Verified, Streak, Ultimo accesso
 * - Click su riga apre modale dettaglio (no browser prompt)
 * - Empty state se nessun risultato
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { EmptyState } from "./EmptyState";

interface AdminUser {
  id:            number;
  name:          string;
  email:         string;
  avatarUrl:     string | null;
  userMode:      string;
  journeyType:   string;
  emailVerified: boolean;
  streakDays:    number;
  lastActiveAt:  string | null;
  createdAt:     string;
}

interface UsersPaginatedResponse {
  users: AdminUser[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

export function AdminUsersPanel() {
  const [data,    setData]    = useState<UsersPaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [page,    setPage]    = useState(1);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const debouncedSearch = useDebounce(search, 300);
  const abortRef = useRef<AbortController | null>(null);

  const fetchUsers = useCallback(async (q: string, p: number) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20", search: q });
      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        credentials: "include",
        signal: ac.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as UsersPaginatedResponse;
      setData(json);
    } catch (err) {
      if ((err as Error).name !== "AbortError") console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    void fetchUsers(debouncedSearch, page);
  }, [debouncedSearch, page, fetchUsers]);

  const users   = data?.users ?? [];
  const pagination = data?.pagination;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold">Student Directory</h2>
        <input
          type="search"
          placeholder="Cerca per nome o email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon="👥"
          title="Nessun utente trovato"
          description={search ? `Nessun risultato per "${search}"` : "Gli studenti registrati appariranno qui."}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Utente", "Email", "Mode", "Journey", "Verified", "Streak", "Ultimo accesso"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setSelected(u)}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-2 flex items-center gap-2">
                    {u.avatarUrl
                      ? <img src={u.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                      : <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">{u.name[0]}</div>
                    }
                    <span className="font-medium">{u.name}</span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{u.userMode}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{u.journeyType}</td>
                  <td className="px-4 py-2">
                    {u.emailVerified
                      ? <span className="text-emerald-500">✓</span>
                      : <span className="text-red-400">✕</span>}
                  </td>
                  <td className="px-4 py-2 text-center">{u.streakDays}🔥</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString("it-IT") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginazione */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {pagination.total} utenti totali
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded px-3 py-1 border disabled:opacity-40 hover:bg-muted transition-colors"
            >
              ←
            </button>
            <span className="px-2 py-1">{page} / {pagination.totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="rounded px-3 py-1 border disabled:opacity-40 hover:bg-muted transition-colors"
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* Modale dettaglio utente */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-background rounded-xl border p-6 w-full max-w-md shadow-xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{selected.name}</h3>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {([
                ["Email",         selected.email],
                ["Mode",          selected.userMode],
                ["Journey",       selected.journeyType],
                ["Email verified",selected.emailVerified ? "Sì" : "No"],
                ["Streak",        `${selected.streakDays} giorni`],
                ["Registrato il", new Date(selected.createdAt).toLocaleDateString("it-IT")],
              ] as [string, string][]).map(([label, val]) => (
                <React.Fragment key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{val}</dd>
                </React.Fragment>
              ))}
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}
