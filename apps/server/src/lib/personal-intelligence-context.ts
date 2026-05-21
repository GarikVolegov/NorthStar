import { buildGraphifyContext } from "./graphify-client";
import { buildOpenHumanContext } from "./openhuman-client";

interface BuildPersonalIntelligenceContextInput {
  query: string;
  userId: number;
  userRole: "user" | "admin";
}

export interface PersonalIntelligenceContext {
  context: string;
  sources: Array<"openhuman" | "graphify">;
}

function graphifyAdminOnly(): boolean {
  return process.env.GRAPHIFY_WENDY_ADMIN_ONLY !== "false";
}

export async function buildPersonalIntelligenceContext({
  query,
  userId,
  userRole,
}: BuildPersonalIntelligenceContextInput): Promise<PersonalIntelligenceContext> {
  const chunks: string[] = [];
  const sources: Array<"openhuman" | "graphify"> = [];

  try {
    const openHuman = await buildOpenHumanContext(query, userId);
    if (openHuman) {
      chunks.push(openHuman);
      sources.push("openhuman");
    }
  } catch {
    // Optional provider: Wendy must keep working when OpenHuman is unavailable.
  }

  if (!graphifyAdminOnly() || userRole === "admin") {
    try {
      const graphify = await buildGraphifyContext(query);
      if (graphify) {
        chunks.push(graphify);
        sources.push("graphify");
      }
    } catch {
      // Optional provider: Graphify is a local/dev graph, never a hard dependency.
    }
  }

  return {
    context: chunks.join(""),
    sources,
  };
}
