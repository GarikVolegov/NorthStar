import fs from "node:fs";
import { OpenAI, toFile } from "openai";
import { Buffer } from "node:buffer";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (_openai) return _openai;

  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";

  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }

  _openai = new OpenAI({ apiKey, baseURL });
  return _openai;
}

/**
 * Lazily-initialized OpenAI client — resolves the singleton on first property access
 * so that env vars are only required at call-time, not at module load time.
 */
export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop): unknown {
    return Reflect.get(getOpenAI(), prop) as unknown;
  },
});

export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "512x512" | "256x256" = "1024x1024"
): Promise<Buffer> {
  const client = getOpenAI();
  const response = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    size,
  });
  const base64 = response.data?.[0]?.b64_json ?? "";
  return Buffer.from(base64, "base64");
}

export async function editImages(
  imageFiles: string[],
  prompt: string,
  outputPath?: string
): Promise<Buffer> {
  const client = getOpenAI();
  const images = await Promise.all(
    imageFiles.map((file) =>
      toFile(fs.createReadStream(file), file, {
        type: "image/png",
      })
    )
  );

  const response = await client.images.edit({
    model: "gpt-image-1",
    image: images,
    prompt,
  });

  const imageBase64 = response.data?.[0]?.b64_json ?? "";
  const imageBytes = Buffer.from(imageBase64, "base64");

  if (outputPath) {
    // SECURITY: outputPath MUST be a server-constructed constant/temp path,
    // never a user- or LLM-supplied string — this is an unconfined write.
    fs.writeFileSync(outputPath, imageBytes);
  }

  return imageBytes;
}
