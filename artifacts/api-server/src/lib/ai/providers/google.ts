/**
 * Provider Google (Gemini)
 * STUB — pronto ma non attivo nel router di default.
 * Attivare via env: AI_STREAMING_PROVIDER=google
 *
 * Richiede: pnpm --filter workspace-api-server add @google/generative-ai
 * Modello default: gemini-1.5-flash
 */

import type { ChatMessage } from "../types";

export async function* streamGoogleChat(
  _messages: ChatMessage[],
  _model: string
): AsyncIterable<string> {
  // TODO: import { GoogleGenerativeAI } from "@google/generative-ai"
  // const genai = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? "");
  // const model = genai.getGenerativeModel({ model: _model });
  // const chat = model.startChat({ history: ... });
  // const result = await chat.sendMessageStream(lastMessage);
  // for await (const chunk of result.stream) yield chunk.text();
  throw new Error(
    "[ai-router] Google provider non ancora configurato. Aggiungi @google/generative-ai e GOOGLE_AI_API_KEY."
  );
}
