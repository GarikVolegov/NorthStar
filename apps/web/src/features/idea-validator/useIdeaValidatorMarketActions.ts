import { useCallback, type Dispatch, type SetStateAction } from "react";

import type { CompetitorEntry, MarketInsight } from "./ideaValidatorTypes";
import { createCompetitor } from "./ideaValidatorUtils";

interface MarketActionOptions {
  activeCompetitor: CompetitorEntry | null;
  competitors: CompetitorEntry[];
  setMarket: Dispatch<SetStateAction<MarketInsight>>;
  setCompetitors: Dispatch<SetStateAction<CompetitorEntry[]>>;
  setActiveCompetitorId: Dispatch<SetStateAction<string>>;
  markDirty: () => void;
}

export function useIdeaValidatorMarketActions(options: MarketActionOptions) {
  const {
    activeCompetitor,
    competitors,
    setMarket,
    setCompetitors,
    setActiveCompetitorId,
    markDirty,
  } = options;

  const updateMarket = useCallback(
    (key: keyof MarketInsight, value: string) => {
      setMarket((current) => ({ ...current, [key]: value }));
      markDirty();
    },
    [markDirty, setMarket],
  );

  const addCompetitor = useCallback(() => {
    const next = createCompetitor();
    setCompetitors((current) => [next, ...current]);
    setActiveCompetitorId(next.id);
    markDirty();
  }, [markDirty, setActiveCompetitorId, setCompetitors]);

  const duplicateActiveCompetitor = useCallback(() => {
    if (!activeCompetitor) return;
    const next = createCompetitor({
      ...activeCompetitor,
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `competitor-${Date.now()}`,
      name: `${activeCompetitor.name || "Competitor"} - copia`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setCompetitors((current) => [next, ...current]);
    setActiveCompetitorId(next.id);
    markDirty();
  }, [activeCompetitor, markDirty, setActiveCompetitorId, setCompetitors]);

  const updateActiveCompetitor = useCallback(
    <K extends keyof CompetitorEntry>(key: K, value: CompetitorEntry[K]) => {
      if (!activeCompetitor) return;
      const now = new Date().toISOString();
      setCompetitors((current) =>
        current.map((item) =>
          item.id === activeCompetitor.id ? { ...item, [key]: value, updatedAt: now } : item,
        ),
      );
      markDirty();
    },
    [activeCompetitor, markDirty, setCompetitors],
  );

  const removeActiveCompetitor = useCallback(() => {
    if (!activeCompetitor) return;
    const remaining = competitors.filter((item) => item.id !== activeCompetitor.id);
    setCompetitors(remaining);
    setActiveCompetitorId(remaining[0]?.id ?? "");
    markDirty();
  }, [activeCompetitor, competitors, markDirty, setActiveCompetitorId, setCompetitors]);

  return {
    updateMarket,
    addCompetitor,
    duplicateActiveCompetitor,
    updateActiveCompetitor,
    removeActiveCompetitor,
  };
}
