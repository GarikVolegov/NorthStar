import { describe, expect, it } from "vitest";

import { parseWendySseEvent } from "./useWendyChatSse";

describe("parseWendySseEvent", () => {
  it("preserves auth gate metadata for Wendy login gates", () => {
    expect(
      parseWendySseEvent(
        JSON.stringify({
          type: "gate",
          feature: "auth_required",
          authRequired: true,
          retryable: false,
          loginUrl: "/login",
          message: "Accedi per parlare con Wendy.",
        }),
      ),
    ).toEqual({
      type: "gate",
      feature: "auth_required",
      authRequired: true,
      retryable: false,
      loginUrl: "/login",
      message: "Accedi per parlare con Wendy.",
    });
  });

  it("parses done context sources and drops unknown providers", () => {
    expect(
      parseWendySseEvent(
        JSON.stringify({
          type: "done",
          requestId: "req-1",
          contextSources: ["rag", "openhuman", "graphify", "unknown"],
          answerMode: "local-fast-path",
          recovery: { reason: "test" },
          adaptiveReasoning: {
            mode: "tool_action",
            reasoningDepth: "grounded",
            dataStrategy: "profile_market",
            executionMode: "tool_augmented_chat",
            selfCheck: ["non_empty", "specific_next_step"],
            latencyTargetMs: 1800,
          },
          suggestedPrompts: [
            { label: "Confronta settori", prompt: "Confronta i primi tre settori" },
            { label: "Prossimo passo", prompt: "Dimmi cosa fare oggi" },
            { label: "", prompt: "Da scartare" },
          ],
        }),
      ),
    ).toEqual({
      type: "done",
      requestId: "req-1",
      contextSources: ["rag", "openhuman", "graphify"],
      answerMode: "local-fast-path",
      recovery: { reason: "test" },
      adaptiveReasoning: {
        mode: "tool_action",
        reasoningDepth: "grounded",
        dataStrategy: "profile_market",
        executionMode: "tool_augmented_chat",
        selfCheck: ["non_empty", "specific_next_step"],
        latencyTargetMs: 1800,
      },
      suggestedPrompts: [
        { label: "Confronta settori", prompt: "Confronta i primi tre settori" },
        { label: "Prossimo passo", prompt: "Dimmi cosa fare oggi" },
      ],
    });
  });
});
