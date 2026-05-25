import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createVisionGpt4oPlugin,
  isVisionGpt4oAvailable,
} from "../plugins/builtin/vision-gpt4o";

describe("vision-gpt4o plugin", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("is available only when the feature flag and OpenAI key are present", () => {
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    process.env.FF_VISION_PLUGIN = "true";
    expect(isVisionGpt4oAvailable()).toBe(false);

    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "test-key";
    process.env.FF_VISION_PLUGIN = "false";
    expect(isVisionGpt4oAvailable()).toBe(false);

    process.env.FF_VISION_PLUGIN = "true";
    expect(isVisionGpt4oAvailable()).toBe(true);
  });

  it("sends image input to the OpenAI chat completions endpoint", async () => {
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "test-key";
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = "https://api.openai.test/v1";

    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => (
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                skills: ["TypeScript"],
                summary: "Profilo tecnico",
              }),
            },
          },
        ],
      })
    ));
    vi.stubGlobal("fetch", fetchMock);

    const plugin = createVisionGpt4oPlugin();
    const result = await plugin.execute({
      image: Buffer.from("fake-image"),
      mimeType: "image/png",
      prompt: "Estrai il profilo",
    });

    expect(result.rawText).toContain("Profilo tecnico");
    expect(result.structured).toEqual({
      skills: ["TypeScript"],
      summary: "Profilo tecnico",
    });
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall?.[0]).toBe("https://api.openai.test/v1/chat/completions");
    const init = firstCall?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      authorization: "Bearer test-key",
      "content-type": "application/json",
    });
  });
});
