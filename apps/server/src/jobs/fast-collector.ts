import { runCollector } from "@workspace/ai-server";

export async function runFastCollector(): Promise<Awaited<ReturnType<typeof runCollector>>> {
  return runCollector({ priorityOnly: true });
}
