import { describe, expect, it } from "vitest";
import { computeNextRun, scheduleToDisplay } from "./routine-schedule";

void dateOnWeekday;

// ── helpers ────────────────────────────────────────────────────────────────────

/** Returns a Date anchored to a specific weekday + hour, always in the past 7 days */
function dateOnWeekday(dow: number, hour: number): Date {
  const d = new Date();
  d.setHours(hour + 1, 0, 0, 0); // just past the target hour → forces "next occurrence"
  const diff = (d.getDay() - dow + 7) % 7 || 7;
  d.setDate(d.getDate() - diff);
  return d;
}

// ── computeNextRun ─────────────────────────────────────────────────────────────

describe("computeNextRun — presets", () => {
  it("daily: next run is today at 09:00 when before 09:00", () => {
    const from = new Date();
    from.setHours(7, 0, 0, 0);
    const next = computeNextRun("daily", from);
    expect(next.getHours()).toBe(9);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
    // within today
    const msGap = next.getTime() - from.getTime();
    expect(msGap).toBeLessThan(24 * 60 * 60 * 1000);
  });

  it("daily: next run is tomorrow at 09:00 when after 09:00", () => {
    const from = new Date();
    from.setHours(10, 0, 0, 0);
    const next = computeNextRun("daily", from);
    expect(next.getHours()).toBe(9);
    const msGap = next.getTime() - from.getTime();
    expect(msGap).toBeGreaterThan(0);
    expect(msGap).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });

  it("accepts ogni_giorno alias for daily", () => {
    const from = new Date();
    from.setHours(7, 0, 0, 0);
    const next = computeNextRun("ogni_giorno", from);
    expect(next.getHours()).toBe(9);
  });

  it("weekly: next run is 7 days ahead at 09:00", () => {
    const from = new Date();
    from.setHours(10, 0, 0, 0);
    const next = computeNextRun("weekly", from);
    expect(next.getHours()).toBe(9);
    const msGap = next.getTime() - from.getTime();
    expect(msGap).toBeGreaterThan(0);
    // at most 7 days
    expect(msGap).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);
  });

  it("every_2_days: next run is within 2 days", () => {
    const from = new Date();
    from.setHours(10, 0, 0, 0);
    const next = computeNextRun("every_2_days", from);
    const msGap = next.getTime() - from.getTime();
    expect(msGap).toBeGreaterThan(0);
    expect(msGap).toBeLessThanOrEqual(2 * 24 * 60 * 60 * 1000);
  });

  it("every_thursday: next run lands on a Thursday", () => {
    // use a Monday as base (guaranteed not Thursday)
    const monday = new Date();
    const dayOffset = (1 - monday.getDay() + 7) % 7;
    monday.setDate(monday.getDate() + (dayOffset === 0 ? 7 : dayOffset));
    monday.setHours(12, 0, 0, 0);
    const next = computeNextRun("every_thursday", monday);
    expect(next.getDay()).toBe(4); // 4 = Thursday
    expect(next.getHours()).toBe(9);
  });

  it("every_monday: next run lands on a Monday", () => {
    const from = new Date();
    from.setHours(12, 0, 0, 0);
    const next = computeNextRun("every_monday", from);
    expect(next.getDay()).toBe(1);
  });

  it("every_sunday: next run lands on a Sunday", () => {
    const from = new Date();
    from.setHours(12, 0, 0, 0);
    const next = computeNextRun("every_sunday", from);
    expect(next.getDay()).toBe(0);
  });

  it("same weekday but past hour → returns 7 days ahead", () => {
    // Create a date that IS a Thursday at 11:00 (past 09:00)
    const thursday = new Date();
    const daysToThursday = (4 - thursday.getDay() + 7) % 7;
    thursday.setDate(thursday.getDate() + daysToThursday);
    thursday.setHours(11, 0, 0, 0);

    const next = computeNextRun("every_thursday", thursday);
    expect(next.getDay()).toBe(4);
    // Must be in the future
    expect(next.getTime()).toBeGreaterThan(thursday.getTime());
  });
});

describe("computeNextRun — cron expression", () => {
  it("'0 9 * * 4' (Thursday 09:00) → next Thursday", () => {
    const from = new Date();
    from.setHours(12, 0, 0, 0);
    const next = computeNextRun("0 9 * * 4", from);
    expect(next.getDay()).toBe(4);
    expect(next.getHours()).toBe(9);
  });

  it("'0 8 * * *' (daily 08:00) → next 08:00", () => {
    const from = new Date();
    from.setHours(6, 0, 0, 0);
    const next = computeNextRun("0 8 * * *", from);
    expect(next.getHours()).toBe(8);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });

  it("'0 9 * * 1' (Monday 09:00) → next Monday", () => {
    const from = new Date();
    from.setHours(12, 0, 0, 0);
    const next = computeNextRun("0 9 * * 1", from);
    expect(next.getDay()).toBe(1);
    expect(next.getHours()).toBe(9);
  });

  it("returns a date strictly in the future", () => {
    const now = new Date();
    const next = computeNextRun("0 9 * * 4", now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("computeNextRun — fallback", () => {
  it("unknown schedule → 24h from now", () => {
    const from = new Date();
    const next = computeNextRun("bogus_schedule", from);
    const msGap = next.getTime() - from.getTime();
    expect(msGap).toBeGreaterThanOrEqual(23 * 60 * 60 * 1000);
    expect(msGap).toBeLessThanOrEqual(25 * 60 * 60 * 1000);
  });
});

// ── scheduleToDisplay ──────────────────────────────────────────────────────────

describe("scheduleToDisplay", () => {
  it.each([
    ["daily",           "Ogni giorno"],
    ["ogni_giorno",     "Ogni giorno"],
    ["weekly",          "Ogni settimana"],
    ["settimanale",     "Ogni settimana"],
    ["every_2_days",    "Ogni 2 giorni"],
    ["every_monday",    "Ogni lunedì"],
    ["every_tuesday",   "Ogni martedì"],
    ["every_wednesday", "Ogni mercoledì"],
    ["every_thursday",  "Ogni giovedì"],
    ["every_friday",    "Ogni venerdì"],
    ["every_saturday",  "Ogni sabato"],
    ["every_sunday",    "Ogni domenica"],
  ])("maps '%s' → '%s'", (schedule, expected) => {
    expect(scheduleToDisplay(schedule)).toBe(expected);
  });

  it("returns the raw string for unknown schedules (passthrough)", () => {
    expect(scheduleToDisplay("0 9 * * 4")).toBe("0 9 * * 4");
    expect(scheduleToDisplay("custom_schedule")).toBe("custom_schedule");
  });
});
