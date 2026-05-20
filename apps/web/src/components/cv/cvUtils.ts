import type { CvData } from "./CvSection";
import type { SavedGeneratedCvData } from "./cvTypes";

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message || fallback : fallback;
}

export function savedCvData(cvData: CvData | null): SavedGeneratedCvData {
  return (cvData ?? {}) as SavedGeneratedCvData;
}

export function formatSavedAt(iso: string) {
  return new Date(iso).toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
