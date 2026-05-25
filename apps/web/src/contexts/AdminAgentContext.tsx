import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-fetch";
import { TOKEN_STORAGE_KEY } from "@/lib/storage-keys";
import type {
  AgentStatus,
  RegistrySnapshot,
} from "@workspace/api-zod/agent-registry";

export type ConnectionState =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed";

interface AdminAgentContextValue {
  snapshot: RegistrySnapshot | null;
  connectionState: ConnectionState;
  refresh: () => Promise<void>;
}

const AdminAgentContext = createContext<AdminAgentContextValue>({
  snapshot: null,
  connectionState: "idle",
  refresh: async () => {},
});

const MAX_BACKOFF_MS = 30_000;

export function AdminAgentProvider({ children }: { children: ReactNode }) {
  const { user, authReady, token } = useAuth();
  const isAdmin = authReady && user?.role === "admin";

  const [snapshot, setSnapshot] = useState<RegistrySnapshot | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");

  const abortRef = useRef<AbortController | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const cancelledRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await apiFetch("/api/admin/agents");
      if (!res.ok) return;
      const data = (await res.json()) as RegistrySnapshot;
      setSnapshot(data);
    } catch {
      // ignore — lo stream live colmera`
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      setSnapshot(null);
      setConnectionState("idle");
      return;
    }

    cancelledRef.current = false;

    const openStream = async () => {
      if (cancelledRef.current) return;
      const controller = new AbortController();
      abortRef.current = controller;
      setConnectionState(
        attemptRef.current === 0 ? "connecting" : "reconnecting",
      );

      const bearer =
        token ??
        (typeof window !== "undefined"
          ? window.sessionStorage.getItem(TOKEN_STORAGE_KEY)
          : null);

      try {
        const requestInit: RequestInit = {
          signal: controller.signal,
          ...(bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : {}),
        };
        const res = await apiFetch("/api/admin/agents/stream", requestInit);
        if (!res.ok || !res.body) throw new Error(`stream HTTP ${res.status}`);

        setConnectionState("open");
        attemptRef.current = 0;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelledRef.current) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx = buffer.indexOf("\n\n");
          while (idx >= 0) {
            const rawEvent = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const dataLine = rawEvent
              .split("\n")
              .find((line) => line.startsWith("data: "));
            if (dataLine) {
              try {
                const parsed = JSON.parse(
                  dataLine.slice(6),
                ) as RegistrySnapshot;
                if (parsed && Array.isArray(parsed.agents)) setSnapshot(parsed);
              } catch {
                // skip malformed
              }
            }
            idx = buffer.indexOf("\n\n");
          }
        }

        if (!cancelledRef.current) {
          scheduleReconnect();
        } else {
          setConnectionState("closed");
        }
      } catch (err) {
        if (cancelledRef.current) {
          setConnectionState("closed");
          return;
        }
        if ((err as Error).name === "AbortError") return;
        scheduleReconnect();
      }
    };

    const scheduleReconnect = () => {
      if (cancelledRef.current) return;
      setConnectionState("reconnecting");
      attemptRef.current += 1;
      const backoff = Math.min(2 ** attemptRef.current * 1000, MAX_BACKOFF_MS);
      reconnectTimerRef.current = window.setTimeout(() => {
        void openStream();
      }, backoff);
    };

    // Snapshot iniziale via REST (non aspetta lo stream).
    void refresh();
    void openStream();

    return () => {
      cancelledRef.current = true;
      abortRef.current?.abort();
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      attemptRef.current = 0;
    };
  }, [isAdmin, token, refresh]);

  useAgentErrorToasts(snapshot);

  const value = useMemo<AdminAgentContextValue>(
    () => ({ snapshot, connectionState, refresh }),
    [snapshot, connectionState, refresh],
  );

  return (
    <AdminAgentContext.Provider value={value}>
      {children}
    </AdminAgentContext.Provider>
  );
}

export function useAdminAgents(): AdminAgentContextValue {
  return useContext(AdminAgentContext);
}

function useAgentErrorToasts(snapshot: RegistrySnapshot | null) {
  const prevStatusRef = useRef<Map<string, AgentStatus>>(new Map());

  useEffect(() => {
    if (!snapshot) return;
    const next = new Map<string, AgentStatus>();
    for (const agent of snapshot.agents) {
      next.set(agent.slug, agent.status);
      const prev = prevStatusRef.current.get(agent.slug);
      if (prev && prev !== "error" && agent.status === "error") {
        toast.error(`${agent.avatar} ${agent.name}`, {
          description: "Agente in errore",
        });
      }
    }
    prevStatusRef.current = next;
  }, [snapshot]);
}
