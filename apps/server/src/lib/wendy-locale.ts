const ITALIAN_MARKERS = /\b(ciao|italiano|parlami|rispondi|cos['’]?è|perché|qual è|grazie|buongiorno|buonasera|app|serve)\b/i;

export function resolveWendyLocale(requestedLocale: string | undefined, message: string): string {
  const normalized = requestedLocale?.slice(0, 2).toLowerCase() || "it";
  if (ITALIAN_MARKERS.test(message)) return "it";
  return normalized;
}
