import {
  buildWendyBrainContextSection,
  searchWendyBrain,
} from "@workspace/ai-server";
import { buildGraphifyContext, type GraphifyProfile } from "./graphify-client";
import { buildOpenHumanContext } from "./openhuman-client";
import { buildSemanticMemoryContext } from "./semantic-memory";

export type WikiLLMContextSource =
  | "rag"
  | "graphify"
  | "wendy-brain"
  | "openhuman"
  | "semantic-memory";

export interface WikiLLMContext {
  context: string;
  contexts: {
    semanticMemory: string;
    openHuman: string;
    graphify: string;
    wendyBrain: string;
  };
  sources: WikiLLMContextSource[];
}

export interface BuildWikiLLMContextInput {
  query: string;
  userId: number;
  userRole: "user" | "admin";
  includePersonalMemory?: boolean;
  includeWendyBrain?: boolean;
  graphifyProfile?: GraphifyProfile | "auto" | null;
  graphifyHeading?: string;
}

function graphifyAdminOnly(): boolean {
  return process.env.GRAPHIFY_WENDY_ADMIN_ONLY !== "false";
}

function hasAny(query: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(query));
}

export function resolveWikiLLMGraphProfile(query: string): GraphifyProfile | null {
  const q = query.toLowerCase();
  if (hasAny(q, [/\btrend\b/, /\bmercato\b/, /\bmarket\b/, /\bstatistic/, /\bwef\b/, /\blinkedin\b/])) {
    return null;
  }
  if (hasAny(q, [/\bcodice\b/, /\bcode\b/, /\bfile\b/, /\bfunzion/, /\bfunction\b/, /\bclass\b/, /\broute\b/, /\bendpoint\b/, /\bapi\b/, /\bimplement/, /\bbug\b/, /\bimport\b/, /\bstreamwikiresponse\b/])) {
    return "code";
  }
  if (hasAny(q, [/\bwendy\b/, /\bagent/, /\bpipeline\b/, /\bprocess/, /\bprocedur/, /\bpolicy\b/, /\bcomport/, /\bbrain\b/, /\brouter\b/])) {
    return "process";
  }
  if (hasAny(q, [/\bwiki\b/, /\bdoc\b/, /\bknowledge base\b/, /\bopenhuman\b/])) {
    return "docs";
  }
  return null;
}

function graphifyTitle(profile: GraphifyProfile | null, fallback: string): string {
  if (fallback) return fallback;
  if (profile === "code") return "Graphify codice";
  if (profile === "process") return "Graphify processi";
  if (profile === "docs") return "Graphify documenti";
  return "Contesto Graphify";
}

function addSource(sources: WikiLLMContextSource[], source: WikiLLMContextSource): void {
  if (!sources.includes(source)) sources.push(source);
}

export async function buildWikiLLMContext(input: BuildWikiLLMContextInput): Promise<WikiLLMContext> {
  const contexts = { semanticMemory: "", openHuman: "", graphify: "", wendyBrain: "" };
  const chunks: string[] = [];
  const sources: WikiLLMContextSource[] = [];
  const includePersonalMemory = input.includePersonalMemory ?? true;

  if (includePersonalMemory) {
    try {
      const semanticMemory = await buildSemanticMemoryContext(input.query, input.userId);
      if (semanticMemory) {
        contexts.semanticMemory = semanticMemory;
        chunks.push(semanticMemory);
        addSource(sources, "semantic-memory");
      }
    } catch {
      // Optional provider.
    }

    try {
      const openHuman = await buildOpenHumanContext(input.query, input.userId);
      if (openHuman) {
        contexts.openHuman = openHuman;
        chunks.push(openHuman);
        addSource(sources, "openhuman");
      }
    } catch {
      // Optional provider.
    }
  }

  const profile =
    input.graphifyProfile === "auto" || input.graphifyProfile === undefined
      ? resolveWikiLLMGraphProfile(input.query)
      : input.graphifyProfile;
  if (profile && (!graphifyAdminOnly() || input.userRole === "admin")) {
    try {
      const graphify = await buildGraphifyContext(input.query, { profile });
      if (graphify) {
        contexts.graphify = graphify.replace(
          "## Contesto Graphify",
          `## ${graphifyTitle(profile, input.graphifyHeading ?? "")}`,
        );
        chunks.push(contexts.graphify);
        addSource(sources, "graphify");
      }
    } catch {
      // Optional local artifact.
    }
  }

  if (input.includeWendyBrain) {
    try {
      const hits = await searchWendyBrain(input.query, { limit: 5, includeCandidates: false });
      const wendyBrain = buildWendyBrainContextSection(hits);
      if (wendyBrain) {
        contexts.wendyBrain = wendyBrain;
        chunks.push(wendyBrain);
        addSource(sources, "wendy-brain");
      }
    } catch {
      // Optional provider.
    }
  }

  return { context: chunks.join(""), contexts, sources };
}
