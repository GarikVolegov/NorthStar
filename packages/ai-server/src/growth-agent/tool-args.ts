import { isRecord } from "../utils";
export { isRecord };


export function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function isClientSideToolData(value: unknown): boolean {
  return isRecord(value) && value.clientSide === true;
}
