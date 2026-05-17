/**
 * AppStateContext — Global store for cross-page variables and constants.
 * Provides shared state accessible from any page/component without prop drilling.
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { eventBus } from "@/lib/event-bus";
import { SCORE_THRESHOLD, NODE_CATEGORY_META } from "@/lib/constants";

export interface UserProfile {
  id: string | null;
  email: string | null;
  name: string | null;
  plan: "free" | "premium" | "enterprise";
  avatarUrl: string | null;
}

export interface TestProgress {
  testId: string | null;
  currentQuestion: number;
  totalQuestions: number;
  answers: Record<string, string>;
  score: number | null;
  completed: boolean;
}

export interface RoadmapState {
  roadmapId: string | null;
  role: string | null;
  level: string | null;
  nodes: Array<{ id: string; label: string; completed: boolean; locked: boolean }>;
  lastGenerated: number | null;
}

export interface GraphState {
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  zoom: number;
  pan: { x: number; y: number };
}

export interface AppStateValue {
  // User
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;

  // Test
  testProgress: TestProgress;
  setTestProgress: (progress: TestProgress) => void;
  resetTestProgress: () => void;

  // Roadmap
  roadmap: RoadmapState;
  setRoadmap: (roadmap: RoadmapState) => void;

  // Graph
  graph: GraphState;
  setGraph: (graph: Partial<GraphState>) => void;

  // Shared constants (read-only, accessible everywhere)
  scoreThresholds: typeof SCORE_THRESHOLD;
  nodeCategories: typeof NODE_CATEGORY_META;

  // UI
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  wendyOpen: boolean;
  setWendyOpen: (open: boolean) => void;

  // Notifications
  notifications: Array<{ id: string; message: string; type: "info" | "success" | "warning" | "error"; read: boolean }>;
  addNotification: (notification: Omit<AppStateValue["notifications"][0], "id" | "read">) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
}

const defaultProfile: UserProfile = {
  id: null,
  email: null,
  name: null,
  plan: "free",
  avatarUrl: null,
};

const defaultTestProgress: TestProgress = {
  testId: null,
  currentQuestion: 0,
  totalQuestions: 0,
  answers: {},
  score: null,
  completed: false,
};

const defaultRoadmap: RoadmapState = {
  roadmapId: null,
  role: null,
  level: null,
  nodes: [],
  lastGenerated: null,
};

const defaultGraph: GraphState = {
  selectedNodeId: null,
  hoveredNodeId: null,
  zoom: 1,
  pan: { x: 0, y: 0 },
};

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile>(defaultProfile);
  const [testProgress, setTestProgressState] = useState<TestProgress>(defaultTestProgress);
  const [roadmap, setRoadmapState] = useState<RoadmapState>(defaultRoadmap);
  const [graph, setGraphState] = useState<GraphState>(defaultGraph);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [wendyOpen, setWendyOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppStateValue["notifications"]>([]);

  const setProfile = useCallback((p: UserProfile) => {
    setProfileState(p);
    eventBus.emit("profile:updated", p);
  }, []);

  const setTestProgress = useCallback((p: TestProgress) => {
    setTestProgressState(p);
    eventBus.emit("test:progress", p);
    if (p.completed) {
      eventBus.emit("test:completed", { score: p.score, testId: p.testId });
    }
  }, []);

  const resetTestProgress = useCallback(() => {
    setTestProgressState(defaultTestProgress);
    eventBus.emit("test:progress", defaultTestProgress);
  }, []);

  const setRoadmap = useCallback((r: RoadmapState) => {
    setRoadmapState(r);
    eventBus.emit("roadmap:updated", r);
  }, []);

  const setGraph = useCallback((g: Partial<GraphState>) => {
    setGraphState((prev) => ({ ...prev, ...g }));
  }, []);

  const addNotification = useCallback(
    (n: Omit<AppStateValue["notifications"][0], "id" | "read">) => {
      const notification = { ...n, id: `notif_${Date.now()}`, read: false };
      setNotifications((prev) => [...prev, notification]);
      eventBus.emit("notification:new", notification);
    },
    []
  );

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Cross-tab sync
  useEffect(() => {
    eventBus.init();

    const unsubProfile = eventBus.on("profile:updated", (e) => {
      setProfileState(e.payload as UserProfile);
    });

    const unsubTest = eventBus.on("test:progress", (e) => {
      setTestProgressState(e.payload as TestProgress);
    });

    const unsubRoadmap = eventBus.on("roadmap:updated", (e) => {
      setRoadmapState(e.payload as RoadmapState);
    });

    return () => {
      unsubProfile();
      unsubTest();
      unsubRoadmap();
    };
  }, []);

  const value: AppStateValue = {
    profile,
    setProfile,
    testProgress,
    setTestProgress,
    resetTestProgress,
    roadmap,
    setRoadmap,
    graph,
    setGraph,
    scoreThresholds: SCORE_THRESHOLD,
    nodeCategories: NODE_CATEGORY_META,
    sidebarOpen,
    setSidebarOpen,
    wendyOpen,
    setWendyOpen,
    notifications,
    addNotification,
    markNotificationRead,
    clearNotifications,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return ctx;
}
