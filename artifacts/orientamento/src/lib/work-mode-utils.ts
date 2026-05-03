import type { WorkPreference } from "@/components/WorkModeSelector";

export function getWorkModeAlignment(
  userWorkMode: WorkPreference | null | undefined,
  sectorModes: Array<string> | null | undefined
): { type: "aligned" | "partial" | "misaligned"; tooltip: string } {
  if (!userWorkMode || userWorkMode === "unknown" || !sectorModes || sectorModes.length === 0) {
    return { type: "aligned", tooltip: "" };
  }

  if (userWorkMode === "ibrido") {
    if (sectorModes.includes("ibrido")) {
      return { type: "aligned", tooltip: "Allineato alla tua modalità di lavoro preferita" };
    }
    return { type: "partial", tooltip: "Compatibile con la tua modalità ibrida, ma non ottimale" };
  }

  if (sectorModes.includes(userWorkMode)) {
    return { type: "aligned", tooltip: "Allineato alla tua modalità di lavoro preferita" };
  }

  return { type: "misaligned", tooltip: `Questo settore è principalmente per ${sectorModes.join("/")}` };
}
