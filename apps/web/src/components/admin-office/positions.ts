export interface DeskPosition {
  xPct: number;
  yPct: number;
}

const POSITIONS_BY_SLUG: Record<string, DeskPosition> = {
  "wendy":          { xPct: 50, yPct: 18 },
  "marco-career":   { xPct: 15, yPct: 35 },
  "lucia-market":   { xPct: 85, yPct: 35 },
  "alex-business":  { xPct: 15, yPct: 75 },
  "sofia-learning": { xPct: 85, yPct: 75 },
  "leo-mindset":    { xPct: 50, yPct: 85 },
};

// Fallback layout per slug non noti: grid 3x2 con 6 slot.
const FALLBACK_SLOTS: DeskPosition[] = [
  { xPct: 22, yPct: 30 },
  { xPct: 50, yPct: 30 },
  { xPct: 78, yPct: 30 },
  { xPct: 22, yPct: 72 },
  { xPct: 50, yPct: 72 },
  { xPct: 78, yPct: 72 },
];

export function positionFor(slug: string, index: number): DeskPosition {
  return (
    POSITIONS_BY_SLUG[slug] ?? FALLBACK_SLOTS[index % FALLBACK_SLOTS.length] ?? { xPct: 50, yPct: 50 }
  );
}
