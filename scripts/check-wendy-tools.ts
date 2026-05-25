import {
  BUILTIN_FEATURE_MANIFESTS,
  validateWendyToolContract,
} from "../packages/ai-server/src/feature-protocol";

const failures: string[] = [];
const tools = BUILTIN_FEATURE_MANIFESTS.flatMap((manifest) =>
  manifest.wendyTools.map((tool) => ({
    ...tool,
    featureId: manifest.id,
  })),
);

for (const tool of tools) {
  const result = validateWendyToolContract(tool);
  if (!result.ok) {
    failures.push(`${tool.featureId}.${tool.name}: ${result.errors.join("; ")}`);
  }
}

const calendarTool = tools.find((tool) => tool.featureId === "calendar" && tool.name === "add_calendar_event");
if (!calendarTool) {
  failures.push("calendar.add_calendar_event tool contract is missing");
} else if (calendarTool.policy !== "write" || !calendarTool.requiresConfirmation) {
  failures.push("calendar.add_calendar_event must be a confirmed write tool");
}

const sectorsDetailTool = tools.find((tool) => tool.featureId === "sectors" && tool.name === "get_sector_detail");
if (!sectorsDetailTool) {
  failures.push("sectors.get_sector_detail tool contract is missing");
} else if (sectorsDetailTool.policy !== "read" || sectorsDetailTool.requiresConfirmation) {
  failures.push("sectors.get_sector_detail must be a low-friction read tool");
}

const profilePreferencesTool = tools.find(
  (tool) => tool.featureId === "profile" && tool.name === "update_profile_preferences",
);
if (!profilePreferencesTool) {
  failures.push("profile.update_profile_preferences tool contract is missing");
} else if (profilePreferencesTool.policy !== "write" || !profilePreferencesTool.requiresConfirmation) {
  failures.push("profile.update_profile_preferences must be a confirmed write tool");
}

const objectiveCreateTool = tools.find((tool) => tool.featureId === "objectives" && tool.name === "save_objective");
if (!objectiveCreateTool) {
  failures.push("objectives.save_objective tool contract is missing");
} else if (objectiveCreateTool.policy !== "write" || !objectiveCreateTool.requiresConfirmation) {
  failures.push("objectives.save_objective must be a confirmed write tool");
}

console.log(
  JSON.stringify(
    {
      status: failures.length === 0 ? "ok" : "fail",
      toolCount: tools.length,
      tools: tools.map((tool) => ({
        featureId: tool.featureId,
        name: tool.name,
        policy: tool.policy,
        risk: tool.risk,
        requiresConfirmation: tool.requiresConfirmation,
      })),
      failures,
    },
    null,
    2,
  ),
);

if (failures.length > 0) {
  process.exitCode = 1;
}
