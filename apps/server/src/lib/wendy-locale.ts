import { detectWendyLanguage } from "@workspace/ai-server";

export function resolveWendyLocale(requestedLocale: string | undefined, message: string): string {
  return detectWendyLanguage({ requestedLocale, message });
}
