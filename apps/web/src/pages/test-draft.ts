export interface TestDraft {
  step: number;
  answers: Record<string, number>;
  savedAt: number;
  sessionId?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return (
    isRecord(value) &&
    Object.values(value).every((item) => typeof item === "number")
  );
}

export function readDraft(value: unknown): TestDraft | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.step !== "number" ||
    typeof value.savedAt !== "number" ||
    !isNumberRecord(value.answers)
  ) {
    return null;
  }
  const draft: TestDraft = {
    step: value.step,
    answers: value.answers,
    savedAt: value.savedAt,
  };
  if (typeof value.sessionId === "number") draft.sessionId = value.sessionId;
  return draft;
}
