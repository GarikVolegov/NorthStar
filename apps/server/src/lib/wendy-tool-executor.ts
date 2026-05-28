import { executeToolCall } from "@workspace/ai-server";
import { executeHostTool, isHostTool } from "./wendy-host-tools";

export async function executeWendyToolCall(
  name: string,
  args: Record<string, unknown>,
  userId: number,
) {
  return isHostTool(name)
    ? executeHostTool(name, args, userId)
    : executeToolCall(name, args, userId);
}
