import type { WorkPreference } from "@/components/WorkModeSelector";

export function getWorkModeAlignment(
  userWorkMode: WorkPreference | null | undefined,
  sectorModes: Array<string> | null | undefined
): { type: "aligned" | "partial" | "misaligned"; tooltipKey: string; tooltipParams?: Record<string, string> } {
  if (!userWorkMode || userWorkMode === "unknown" || !sectorModes || sectorModes.length === 0) {
    return { type: "aligned", tooltipKey: "" };
  }

  if (userWorkMode === "ibrido") {
    if (sectorModes.includes("ibrido")) {
      return { type: "aligned", tooltipKey: "workModeAlignment.aligned" };
    }
    return { type: "partial", tooltipKey: "workModeAlignment.partialHybrid" };
  }

  if (sectorModes.includes(userWorkMode)) {
    return { type: "aligned", tooltipKey: "workModeAlignment.aligned" };
  }

  return { type: "misaligned", tooltipKey: "workModeAlignment.misaligned", tooltipParams: { modes: sectorModes.join("/") } };
}
