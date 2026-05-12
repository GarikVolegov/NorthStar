function isEnabled(name: string, defaultVal = true): boolean {
  const val = process.env[name];
  if (val === undefined) return defaultVal;
  return val === "true" || val === "1";
}

export const FF = {
  parallelHandoff: isEnabled("FF_PARALLEL_HANDOFF", true),
  generativeUI: isEnabled("FF_GENERATIVE_UI", true),
  chainOfThought: isEnabled("FF_CHAIN_OF_THOUGHT", true),
  supervisorEnabled: isEnabled("FF_SUPERVISOR", true),
  memoryEnabled: isEnabled("FF_MEMORY", true),
};
