/**
 * ai/vision.ts — Vision Language Model (VLM) facade
 *
 * Fornisce:
 *   analyzeImages()   — analisi sincrona (risposta completa)
 *   streamAnalyzeImages() — streaming chunk-by-chunk (SSE)
 *   generateImage()   — generazione immagini con DALL-E
 *
 * Provider supportati:
 *   openai    — gpt-4o (default) — miglior rapporto velocità/qualità
 *   anthropic — claude-3-7-sonnet-20250219 — eccelle su PDF/tabelle
 *   google    — gemini-2.0-flash — alternativa economica, multiframe video
 *
 * Limiti immagini per chiamata:
 *   OpenAI:    max 10 immagini, max 20MB/immagine
 *   Anthropic: max 20 immagini, max 5MB/immagine
 *   Google:    max 16 immagini con gemini-flash
 *
 * Validazione input:
 *   - URL devono iniziare con https:// (nessun URL http o localhost)
 *   - data-URI devono iniziare con data:image/ (png/jpeg/webp/gif)
 *   - max MAX_IMAGES_PER_REQUEST immagini per chiamata
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../logger.js';
import type {
  VisionRequest, VisionResult,
  ImageGenRequest, ImageGenResult,
  TextPart, ImagePart,
} from './types.js';

// ─── Configurazione ──────────────────────────────────────────────────────────────

const MAX_IMAGES_PER_REQUEST = 5;

const VLM_MODELS = {
  openai:    'gpt-4o',
  anthropic: 'claude-3-7-sonnet-20250219',
  google:    'gemini-2.0-flash',
} as const;

// ─── Lazy SDK instances ──────────────────────────────────────────────────────────
// Istanziati al primo uso per non bloccare il startup se le chiavi mancano

let _openai: OpenAI | null = null;
let _anthropic: Anthropic | null = null;
let _google: GoogleGenerativeAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}
function getGoogle(): GoogleGenerativeAI {
  if (!_google) _google = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? '');
  return _google;
}

// ─── Helpers di validazione ───────────────────────────────────────────────────────

function validateImageUrls(images: string[]): void {
  if (images.length === 0)       throw new Error('Nessuna immagine fornita');
  if (images.length > MAX_IMAGES_PER_REQUEST)
    throw new Error(`Massimo ${MAX_IMAGES_PER_REQUEST} immagini per richiesta`);

  for (const url of images) {
    const isHttps    = url.startsWith('https://');
    const isDataUri  = url.startsWith('data:image/');
    if (!isHttps && !isDataUri)
      throw new Error(`URL immagine non valido: ${url.slice(0, 60)}`);
  }
}

/** Determina il MIME type di un data-URI */
function mimeFromDataUri(uri: string): string {
  const match = uri.match(/^data:([^;]+);base64,/);
  return match?.[1] ?? 'image/jpeg';
}

/** Estrae la stringa base64 pura da un data-URI */
function b64FromDataUri(uri: string): string {
  return uri.split(',')[1] ?? '';
}

// ─── OpenAI Vision ──────────────────────────────────────────────────────────────

function buildOpenAIImageContent(
  images: string[],
  prompt: string,
  detail: VisionRequest['detail'] = 'auto',
): OpenAI.Chat.ChatCompletionContentPart[] {
  const parts: OpenAI.Chat.ChatCompletionContentPart[] = [
    { type: 'text', text: prompt },
  ];
  for (const url of images) {
    parts.push({
      type: 'image_url',
      image_url: { url, detail: detail ?? 'auto' },
    });
  }
  return parts;
}

async function analyzeWithOpenAI(req: VisionRequest): Promise<VisionResult> {
  const t0    = Date.now();
  const model = VLM_MODELS.openai;
  const oai   = getOpenAI();

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  // Inietta history se presente
  for (const h of req.history ?? []) {
    messages.push({ role: h.role, content: h.content });
  }

  messages.push({
    role:    'user',
    content: buildOpenAIImageContent(req.images, req.prompt, req.detail),
  });

  const resp = await oai.chat.completions.create({
    model,
    messages,
    max_tokens:  req.maxTokens  ?? 1024,
    temperature: req.temperature ?? 0.2,
  });

  return {
    text:         resp.choices[0]?.message?.content ?? '',
    provider:     'openai',
    model,
    inputTokens:  resp.usage?.prompt_tokens     ?? 0,
    outputTokens: resp.usage?.completion_tokens ?? 0,
    durationMs:   Date.now() - t0,
  };
}

async function* streamWithOpenAI(req: VisionRequest): AsyncIterable<string> {
  const model = VLM_MODELS.openai;
  const oai   = getOpenAI();

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  for (const h of req.history ?? []) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({
    role:    'user',
    content: buildOpenAIImageContent(req.images, req.prompt, req.detail),
  });

  const stream = await oai.chat.completions.create({
    model,
    messages,
    max_tokens:  req.maxTokens  ?? 1024,
    temperature: req.temperature ?? 0.2,
    stream:      true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

// ─── Anthropic Vision ───────────────────────────────────────────────────────────

function buildAnthropicImageContent(
  images: string[],
  prompt: string,
): Anthropic.MessageParam['content'] {
  const content: Anthropic.ContentBlockParam[] = [];

  for (const url of images) {
    if (url.startsWith('https://')) {
      content.push({
        type:   'image',
        source: { type: 'url', url } as Anthropic.URLImageSource,
      });
    } else {
      // data-URI base64
      const mediaType = mimeFromDataUri(url) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      content.push({
        type:   'image',
        source: {
          type:       'base64',
          media_type: mediaType,
          data:       b64FromDataUri(url),
        },
      });
    }
  }

  content.push({ type: 'text', text: prompt });
  return content;
}

async function analyzeWithAnthropic(req: VisionRequest): Promise<VisionResult> {
  const t0    = Date.now();
  const model = VLM_MODELS.anthropic;
  const anth  = getAnthropic();

  const messages: Anthropic.MessageParam[] = [];
  for (const h of req.history ?? []) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({
    role:    'user',
    content: buildAnthropicImageContent(req.images, req.prompt),
  });

  const resp = await anth.messages.create({
    model,
    messages,
    max_tokens:  req.maxTokens  ?? 1024,
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return {
    text,
    provider:     'anthropic',
    model,
    inputTokens:  resp.usage.input_tokens,
    outputTokens: resp.usage.output_tokens,
    durationMs:   Date.now() - t0,
  };
}

async function* streamWithAnthropic(req: VisionRequest): AsyncIterable<string> {
  const model = VLM_MODELS.anthropic;
  const anth  = getAnthropic();

  const messages: Anthropic.MessageParam[] = [];
  for (const h of req.history ?? []) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({
    role:    'user',
    content: buildAnthropicImageContent(req.images, req.prompt),
  });

  const stream = anth.messages.stream({
    model,
    messages,
    max_tokens: req.maxTokens ?? 1024,
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}

// ─── Google Gemini Vision ─────────────────────────────────────────────────────────

async function analyzeWithGoogle(req: VisionRequest): Promise<VisionResult> {
  const t0    = Date.now();
  const model = VLM_MODELS.google;
  const gen   = getGoogle();
  const genModel = gen.getGenerativeModel({ model });

  const parts: Array<string | { inlineData: { data: string; mimeType: string } }> = [
    req.prompt,
  ];

  for (const url of req.images) {
    if (url.startsWith('data:image/')) {
      parts.push({
        inlineData: {
          data:     b64FromDataUri(url),
          mimeType: mimeFromDataUri(url),
        },
      });
    } else {
      // Gemini non supporta URL diretti: converti in fetch + base64
      // NOTA: in produzione, usa Google Cloud Storage per URL pubblici
      logger.warn({ url: url.slice(0, 60) },
        '[vision/google] URL pubblici non supportati direttamente — usa data-URI');
      parts.push(url); // fallback: passa come testo
    }
  }

  const result = await genModel.generateContent(parts as Parameters<typeof genModel.generateContent>[0]);
  const text   = result.response.text();

  return {
    text,
    provider:     'google',
    model,
    inputTokens:  0,  // Gemini non espone token count in questa API version
    outputTokens: 0,
    durationMs:   Date.now() - t0,
  };
}

// ─── DALL-E Image Generation ────────────────────────────────────────────────────────

export async function generateImage(req: ImageGenRequest): Promise<ImageGenResult> {
  const t0    = Date.now();
  const model = req.model ?? 'dall-e-3';
  const oai   = getOpenAI();

  // DALL-E 3 / gpt-image-1: solo n=1
  const n = (model === 'dall-e-2') ? (req.n ?? 1) : 1;

  const resp = await oai.images.generate({
    model,
    prompt:          req.prompt,
    n,
    size:            (req.size ?? '1024x1024') as Parameters<typeof oai.images.generate>[0]['size'],
    quality:         req.quality ?? 'standard',
    style:           req.style ?? 'vivid',
    response_format: req.responseFormat ?? 'url',
  });

  const images = (resp.data ?? []).map((img) => ({
    url:           img.url,
    b64:           img.b64_json,
    revisedPrompt: img.revised_prompt,
  }));

  logger.info({ model, n, durationMs: Date.now() - t0 }, '[vision] image generated');

  return { images, model, durationMs: Date.now() - t0 };
}

// ─── API pubblica ──────────────────────────────────────────────────────────────────

/**
 * Analisi sincrona — attende la risposta completa.
 * Usa per: estrazione dati strutturati, OCR documenti, score.
 */
export async function analyzeImages(req: VisionRequest): Promise<VisionResult> {
  validateImageUrls(req.images);
  const provider = req.provider ?? 'openai';

  logger.info({
    provider,
    model:      VLM_MODELS[provider],
    imageCount: req.images.length,
    promptLen:  req.prompt.length,
  }, '[vision] analyze start');

  switch (provider) {
    case 'openai':    return analyzeWithOpenAI(req);
    case 'anthropic': return analyzeWithAnthropic(req);
    case 'google':    return analyzeWithGoogle(req);
    default:          return analyzeWithOpenAI(req);
  }
}

/**
 * Analisi con streaming SSE — ritorna chunk di testo progressivi.
 * Usa per: risposte Wendy in tempo reale su immagini.
 */
export async function* streamAnalyzeImages(
  req: VisionRequest,
): AsyncIterable<string> {
  validateImageUrls(req.images);
  const provider = req.provider ?? 'openai';

  logger.info({
    provider,
    model:      VLM_MODELS[provider],
    imageCount: req.images.length,
  }, '[vision] stream analyze start');

  switch (provider) {
    case 'openai':    yield* streamWithOpenAI(req);    break;
    case 'anthropic': yield* streamWithAnthropic(req); break;
    case 'google':    {
      // Google non supporta streaming nativo nell'SDK Node — simula con singola call
      const result = await analyzeWithGoogle(req);
      yield result.text;
      break;
    }
    default:          yield* streamWithOpenAI(req);
  }
}
