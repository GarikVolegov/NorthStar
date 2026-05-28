/**
 * routine-schedule.ts — calcolo del prossimo run per una routine.
 *
 * Supporta due formati di schedule:
 *   1. Preset human-readable: "daily", "weekly", "every_monday", "every_thursday", ...
 *   2. Cron expression standard: "0 9 * * 4" (usata internamente)
 *
 * computeNextRun è usata da:
 *   - POST /api/routines (imposta il primo nextRunAt alla creazione)
 *   - routine-scheduler.ts (aggiorna nextRunAt dopo ogni esecuzione)
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** Mappa preset → giorno della settimana (0=domenica, 1=lunedì, ...) */
const PRESET_DOW: Record<string, number> = {
  every_sunday:    0,
  every_monday:    1,
  every_tuesday:   2,
  every_wednesday: 3,
  every_thursday:  4,
  every_friday:    5,
  every_saturday:  6,
};

/** Mappa preset → ore di invio (default 09:00 locale) */
const DEFAULT_HOUR = 9;

/**
 * Calcola il prossimo Date in cui una routine deve girare,
 * a partire da `from` (default: now).
 *
 * Per le cron expression standard usa un'implementazione minima
 * che copre i pattern comuni (campo minuto e ora sono rispettati,
 * giorno-della-settimana è rispettato).
 * Per schedule complesse richiederebbe croner/cron-parser — da aggiungere in Step 3.
 */
export function computeNextRun(schedule: string, from: Date = new Date()): Date {
  const normalized = schedule.trim().toLowerCase();

  // ── Preset: daily ──────────────────────────────────────────────────────────
  if (normalized === "daily" || normalized === "ogni_giorno" || normalized === "ogni giorno") {
    return nextTimeAtHour(from, DEFAULT_HOUR, DAY_MS);
  }

  // ── Preset: weekly / ogni_settimana ───────────────────────────────────────
  if (normalized === "weekly" || normalized === "ogni_settimana" || normalized === "settimanale") {
    return nextTimeAtHour(from, DEFAULT_HOUR, WEEK_MS);
  }

  // ── Preset: every_2_days ─────────────────────────────────────────────────
  if (normalized === "every_2_days" || normalized === "ogni_2_giorni") {
    return nextTimeAtHour(from, DEFAULT_HOUR, 2 * DAY_MS);
  }

  // ── Preset: every_<weekday> ───────────────────────────────────────────────
  const dowPreset = PRESET_DOW[normalized];
  if (dowPreset !== undefined) {
    return nextWeekday(from, dowPreset, DEFAULT_HOUR);
  }

  // ── Cron expression (5 campi: min h dom mon dow) ──────────────────────────
  // Supporta pattern comuni come "0 9 * * 4" (giovedì alle 9).
  // Campo "dom" e "mon" vengono ignorati (trattati come *).
  const parts = normalized.split(/\s+/);
  if (parts.length === 5) {
    const [, hourPart, , , dowPart] = parts;
    const hour = hourPart === "*" ? DEFAULT_HOUR : parseInt(hourPart ?? "9", 10);
    if (!isNaN(hour)) {
      if (dowPart === "*" || dowPart === undefined) {
        return nextTimeAtHour(from, hour, DAY_MS);
      }
      const dow = parseInt(dowPart, 10);
      if (!isNaN(dow)) {
        return nextWeekday(from, dow % 7, hour);
      }
    }
  }

  // ── Fallback: 24 ore da ora ───────────────────────────────────────────────
  return new Date(from.getTime() + DAY_MS);
}

/** Ritorna un Date alla prossima occorrenza di `hour:00` almeno `minGapMs` nel futuro. */
function nextTimeAtHour(from: Date, hour: number, minGapMs: number): Date {
  const candidate = new Date(from);
  candidate.setHours(hour, 0, 0, 0);

  // Se l'ora di oggi è già passata, aggiungi il gap (giorno/settimana)
  if (candidate.getTime() <= from.getTime()) {
    candidate.setTime(candidate.getTime() + minGapMs);
  }
  return candidate;
}

/** Ritorna il prossimo Date corrispondente a `dowTarget` (0=dom) alle `hour:00`. */
function nextWeekday(from: Date, dowTarget: number, hour: number): Date {
  const candidate = new Date(from);
  candidate.setHours(hour, 0, 0, 0);

  const currentDow = from.getDay();
  let daysAhead = dowTarget - currentDow;
  if (daysAhead < 0) daysAhead += 7;
  // Stesso giorno ma ora passata → settimana prossima
  if (daysAhead === 0 && candidate.getTime() <= from.getTime()) daysAhead = 7;

  candidate.setDate(candidate.getDate() + daysAhead);
  return candidate;
}

/**
 * Normalizza un preset human-readable in cron expression (per storage opzionale).
 * Usato solo per display; il worker usa sempre computeNextRun().
 */
export function scheduleToDisplay(schedule: string): string {
  const map: Record<string, string> = {
    daily:           "Ogni giorno",
    ogni_giorno:     "Ogni giorno",
    weekly:          "Ogni settimana",
    ogni_settimana:  "Ogni settimana",
    settimanale:     "Ogni settimana",
    every_2_days:    "Ogni 2 giorni",
    every_monday:    "Ogni lunedì",
    every_tuesday:   "Ogni martedì",
    every_wednesday: "Ogni mercoledì",
    every_thursday:  "Ogni giovedì",
    every_friday:    "Ogni venerdì",
    every_saturday:  "Ogni sabato",
    every_sunday:    "Ogni domenica",
  };
  return map[schedule.toLowerCase()] ?? schedule;
}
