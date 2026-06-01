import { randomUUID } from "node:crypto";

export function buildConfirmableClientAction(
  toolName: string,
  args: Record<string, unknown>,
) {
  if (toolName === "set_filters") {
    const filters =
      args.filters &&
      typeof args.filters === "object" &&
      !Array.isArray(args.filters)
        ? (args.filters as Record<string, unknown>)
        : {};
    const listType = typeof args.listType === "string" ? args.listType : "sectors";
    return {
      clientSide: true,
      action: "set_filters",
      wendyAction: {
        id: `wendy-set_filters-${randomUUID()}`,
        type: "set_filters",
        status: "needs_confirmation",
        risk: "low",
        label: "Preparare Esplora settori?",
        description: "Applico i filtri quando confermi, cosi non interrompo la risposta.",
        requiresConfirmation: true,
        payload: { listType, filters },
        preview: Object.entries(filters).slice(0, 4).map(([label, value]) => ({
          label,
          value: typeof value === "string" ? value : JSON.stringify(value),
        })),
      },
    };
  }

  const viewId = typeof args.viewId === "string" ? args.viewId : "settori";
  const targetRoute = viewId === "settori" ? "/settori" : "/dashboard";
  return {
    clientSide: true,
    action: "navigate",
    wendyAction: {
      id: `wendy-navigate-${randomUUID()}`,
      type: "navigate",
      status: "needs_confirmation",
      risk: "low",
      label: "Aprire Esplora settori?",
      description: "Apro la pagina quando confermi, senza tagliare la risposta di Wendy.",
      requiresConfirmation: true,
      targetRoute,
      payload: { url: targetRoute, viewId },
      preview: [{ label: "Destinazione", value: targetRoute }],
    },
  };
}
