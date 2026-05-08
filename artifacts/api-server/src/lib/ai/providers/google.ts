/**
 * Provider Google Gemini — v2: supporto multimodale
 *
 * Novità:
 *   - normalizeGoogleParts(): converte MessageContent in
 *     GoogleGenerativeAI Part[] (testo + inlineData base64)
 *   - streamGoogleChat aggiornato per gestire contenuto multimodale
 *   - Nota: Gemini via SDK Node non supporta URL pubblici come parti;
 *     i data-URI vengono convertiti in inlineData.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Part, InlineDataPart, TextPart as GTextPart } from '@google/generative-ai';
import type { ChatMessage, MessageContent } from '../types.js';

let _google: GoogleGenerativeAI | null = null;

function getGoogle(): GoogleGenerativeAI {
  if (!_google) {
    const apiKey = process.env.GOOGLE_AI_API_KEY ?? '';
    _google = new GoogleGenerativeAI(apiKey);
  }
  return _google;
}

// ─── Normalizzatore messaggi ──────────────────────────────────────────────────────────

function contentToGoogleParts(content: MessageContent): Part[] {
  if (typeof content === 'string') {
    return [{ text: content } as GTextPart];
  }

  return content.map((part) => {
    if (part.type === 'text') {
      return { text: part.text } as GTextPart;
    }

    // image_url: Gemini SDK vuole inlineData (base64)
    if (part.url.startsWith('data:image/')) {
      const mimeMatch  = part.url.match(/^data:([^;]+);base64,/);
      const mimeType   = mimeMatch?.[1] ?? 'image/jpeg';
      const base64Data = part.url.split(',')[1] ?? '';
      return {
        inlineData: { mimeType, data: base64Data },
      } as InlineDataPart;
    }

    // URL pubblico: passa come testo (Gemini SDK non supporta fetch remoto)
    // In produzione usa Google Cloud Storage o converti lato server
    return { text: `[immagine: ${part.url}]` } as GTextPart;
  });
}

// ─── Streaming chat ────────────────────────────────────────────────────────────────

export async function* streamGoogleChat(
  messages: ChatMessage[],
  model     = 'gemini-2.0-flash',
): AsyncIterable<string> {
  const google    = getGoogle();
  const genModel  = google.getGenerativeModel({ model });

  // Gemini usa history separata dall'ultimo messaggio
  const history   = messages.slice(0, -1);
  const last      = messages[messages.length - 1];

  if (!last) return;

  const chat = genModel.startChat({
    history: history
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role:  m.role === 'assistant' ? 'model' : 'user',
        parts: contentToGoogleParts(m.content),
      })),
  });

  const lastParts = contentToGoogleParts(last.content);
  const result    = await chat.sendMessageStream(lastParts);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}
