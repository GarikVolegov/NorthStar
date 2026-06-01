import type { CoachMemoryFact, CoachMemoryPattern } from "@workspace/db";

export interface MemoryFact {
  key: string;
  value: string;
}

export interface MemoryPattern {
  patternType: "limiting_belief" | "strength" | "recurring_theme" | "emotional_trigger" | "growth_edge";
  description: string;
}

export interface ExtractedMemory {
  facts: MemoryFact[];
  patterns: MemoryPattern[];
}

export interface UserMemory {
  facts: CoachMemoryFact[];
  patterns: CoachMemoryPattern[];
}
