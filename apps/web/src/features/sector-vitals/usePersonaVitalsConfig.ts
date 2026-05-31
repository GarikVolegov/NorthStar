import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkPreference, type WorkPreference } from "@/components/WorkModeSelector";
import type { VitalKey } from "@workspace/api-client-react";

export interface PersonaVitalsConfig {
  visible: VitalKey[];
  emphasized: VitalKey[];
  tone: "plain" | "standard";
}

const ALL: VitalKey[] = ["pulse", "oxygen", "temperature", "pressure", "adrenaline"];

export function getPersonaVitalsConfig(
  workPreference: WorkPreference | "investitore" | "azienda" | null | undefined,
  journeyType: string | null | undefined,
): PersonaVitalsConfig {
  if (journeyType === "indeciso" || workPreference === "unknown") {
    return { visible: ["pulse", "oxygen"], emphasized: ["pulse"], tone: "plain" };
  }
  if (journeyType === "azienda") {
    return { visible: ALL, emphasized: ["oxygen", "pulse"], tone: "standard" };
  }
  if (workPreference === "autonomo" || journeyType === "autonomo") {
    return { visible: ALL, emphasized: ["pulse", "pressure"], tone: "standard" };
  }
  return { visible: ALL, emphasized: [], tone: "standard" };
}

export function usePersonaVitalsConfig(): PersonaVitalsConfig {
  const { user } = useAuth();
  const { workPreference } = useWorkPreference(user?.id);
  return useMemo(
    () => getPersonaVitalsConfig(workPreference, user?.journeyType ?? null),
    [workPreference, user?.journeyType],
  );
}
