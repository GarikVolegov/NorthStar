/**
 * EventBus — Cross-page communication via BroadcastChannel + in-process emitter.
 * Enables real-time sync between tabs and within the same app instance.
 *
 * @pattern Singleton + Observer + BroadcastChannel cross-tab
 * @see hooks/usePageBus.ts per la wrapper React-idiomatic
 */

export type EventName =
  | "auth:login"
  | "auth:logout"
  | "auth:token_refresh"
  | "admin:login"
  | "admin:logout"
  | "test:completed"
  | "test:progress"
  | "test:submitted"
  | "roadmap:generated"
  | "roadmap:updated"
  | "graph:node_selected"
  | "graph:node_created"
  | "graph:node_deleted"
  | "score:updated"
  | "profile:updated"
  | "subscription:changed"
  | "error:caught"
  | "state:sync_request"
  | "state:sync_response"
  | "notification:new"
  | "wendy:response"
  | "cache:invalidate"
  // Step 7+: page lifecycle e comunicazione inter-pagina (foundation refactor)
  | "page:mounted"
  | "page:unmounted"
  | "page:message";

export interface AppEvent<T = unknown> {
  name: EventName;
  payload: T;
  timestamp: number;
  source: string;
}

type Listener<T = unknown> = (event: AppEvent<T>) => void;

const CHANNEL_NAME = "northstar_events";
const SOURCE_ID = `ns_${Math.random().toString(36).slice(2, 10)}`;

class EventBus {
  private listeners = new Map<string, Set<Listener>>();
  private channel: BroadcastChannel | null = null;
  private initialized = false;

  init() {
    if (this.initialized) return;
    try {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event: MessageEvent<AppEvent>) => {
        if (event.data.source === SOURCE_ID) return;
        this.emitLocal(event.data);
      };
      this.initialized = true;
    } catch {
      // BroadcastChannel not supported (e.g., SSR)
      this.initialized = true;
    }
  }

  emit<T>(name: EventName, payload: T) {
    const event: AppEvent<T> = {
      name,
      payload,
      timestamp: Date.now(),
      source: SOURCE_ID,
    };
    this.emitLocal(event);
    if (this.channel) {
      try {
        this.channel.postMessage(event);
      } catch {
        // Channel closed
      }
    }
  }

  on<T>(name: EventName, listener: Listener<T>) {
    if (!this.listeners.has(name)) {
      this.listeners.set(name, new Set());
    }
    this.listeners.get(name)!.add(listener as Listener);
    return () => this.off(name, listener);
  }

  off<T>(name: EventName, listener: Listener<T>) {
    this.listeners.get(name)?.delete(listener as Listener);
  }

  once<T>(name: EventName, listener: Listener<T>) {
    const unsubscribe = this.on(name, (event: AppEvent<T>) => {
      listener(event);
      unsubscribe();
    });
    return unsubscribe;
  }

  private emitLocal<T>(event: AppEvent<T>) {
    const listeners = this.listeners.get(event.name);
    if (!listeners) return;
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error(`[EventBus] Error in listener for "${event.name}":`, err);
      }
    }
  }

  destroy() {
    this.channel?.close();
    this.channel = null;
    this.listeners.clear();
    this.initialized = false;
  }
}

export const eventBus = new EventBus();
