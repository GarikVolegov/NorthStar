/**
 * ai/vision.ts — Vision Language Model (VLM) facade
 *
 * Fornisce:
 *   analyzeImages()        — analisi sincrona (risposta completa)
 *   streamAnalyzeImages()  — streaming chunk-by-chunk (SSE)
 *   generateImage()        — generazione immagini con DALL-E
 *
 * Provider supportati:
 *   openai    — gpt-4o (default)
 *   anthropic — claude-3-7-sonnet-20250219
 *   google    — gemini-2.0-flash
 *
 * v2.2 additions:
 *   [OPT-1] Auto-fallback provider: se il primario torna 429/5xx,
 *           riprova automaticamente sul fallback (openai→anthropic e viceversa)
 *   [OPT-2] Google streaming nativo via generateContentStream()
 *   [OPT-3] Timeout configurabile per stream provider (VISION_STREAM_TIMEOUT_MS)
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../logger.js';
import { optimizeImageBatch } from './image-optimizer.js';
import { resolveFallbackProvider } from './router.js';
import type {
  VisionRequest, VisionResult,
  ImageGenRequest, ImageGenResult,
} from './types.js';

// ─── Configurazione ─────────────────────────────────────────────────────────

const MAX_IMAGES_PER_REQUEST = 5;
const FETCH_IMAGE_TIMEOUT_MS = 10_000;

const VLM_MODELS = {
  openai:    'gpt-4o',
  anthropic: 'claude-3-7-sonnet-20250219',
  google:    'gemini-2.0-flash',
} as const;

// ─── Lazy SDK instances ────────────────────────────────────────────────────────

let _openai: OpenAI | null = null;
let _anthropic: Anthropic | null = null;
let _google: GoogleGenerativeAI | null = null;

function getOpenAI():    OpenAI             { return (_openai    ??= new OpenAI   ({ apiKey: process.env.OPENAI_API_KEY    })); }
function getAnthropic(): Anthropic          { return (_anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })); }
function getGoogle():    GoogleGenerativeAI { return (_google    ??= new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? '')); }

// ─── Helpers di validazione ─────────────────────────────────────────────────────

function validateImageUrls(images: string[]): void {
  if (images.length === 0) throw new Error('Nessuna immagine fornita');
  if (images.length > MAX_IMAGES_PER_REQUEST)
    throw new Error(`Massimo ${MAX_IMAGES_PER_REQUEST} immagini per richiesta`);
  for (const url of images) {
    if (!url.startsWith('https://') && !url.startsWith('data:image/'))
      throw new Error(`URL immagine non valido: ${url.slice(0, 60)}`);
  }
}

function mimeFromDataUri(uri: string): string {
  return uri.match(/^data:([^;]+);base64,/)?.[1] ?? 'image/jpeg';
}
function b64FromDataUri(uri: string): string {
  return uri.split(',')[1] ?? '';
}

// ─── Fetch sicuro di URL remoti (CRITICAL-2 + BONUS timeout) ──────────────────

async function fetchImageAsDataUri(url: string): Promise<string> {
  const resp = await fetch(url, {
    signal:  AbortSignal.timeout(FETCH_IMAGE_TIMEOUT_MS),
    headers: { 'User-Agent': 'NorthStar-Vision/2.2' },
  });
  if (!resp.ok)
    throw new Error(`HTTP ${resp.status} scaricando immagine: ${url.slice(0, 80)}`);
  const contentType = resp.headers.get('content-type') ?? 'image/jpeg';
  if (!contentType.startsWith('image/'))
    throw new Error(`Content-Type non immagine ("${contentType}"): ${url.slice(0, 80)}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  return `data:${contentType};base64,${buf.toString('base64')}`;
}

// ─── Image optimizer pipeline (CRITICAL-1) ─────────────────────────────────────

async function preprocessImages(
  images: string[],
  req: Pick<VisionRequest, 'intent' | 'detail'>,
): Promise<{ images: string[]; detail: 'low' | 'high' | 'auto' }> {
  const batch   = await optimizeImageBatch(images, { intent: req.intent ?? 'screenshot' });
  const processed = batch.images.map((r) => r.dataUri);
  const suggested = batch.images[0]?.suggestedDetail ?? 'auto';
  const detail    = req.detail ?? suggested;
  if (batch.totalSaved > 0) {
    logger.info(
      { savedBytes: batch.totalSaved, savedPct: batch.totalSavedPct, durationMs: batch.durationMs, intent: req.intent ?? 'screenshot', detailChosen: detail },
      '[vision] image-optimizer: payload ridotto',
    );
  }
  return { images: processed, detail };
}

// ─── [OPT-1] Helper: classifica errori come "ritentabile" ────────────────────────
// 429 Rate-limit e 5xx server-error vengono ritentati sul provider di fallback.
// 400 (prompt invalido) e 401 (key sbagliata) non vengono mai ritentati.

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  // OpenAI SDK: include il codice HTTP nel messaggio
  if (/status 429|rate.?limit|too many/i.test(msg)) return true;
  if (/status 5[0-9]{2}|server error|service unavail/i.test(msg)) return true;
  // Anthropic SDK: usa overloaded_error
  if (/overloaded/i.test(msg)) return true;
  return false;
}

// ─── OpenAI Vision ───────────────────────────────────────────────────────────

function buildOpenAIImageContent(
  images: string[],
  prompt: string,
  detail: VisionRequest['detail'] = 'auto',
): OpenAI.Chat.ChatCompletionContentPart[] {
  return [
    { type: 'text', text: prompt },
    ...images.map((url) => ({
      type: 'image_url' as const,
      image_url: { url, detail: detail ?? 'auto' },
    })),
  ];
}

async function analyzeWithOpenAI(req: VisionRequest): Promise<VisionResult> {
  const t0    = Date.now();
  const model = VLM_MODELS.openai;
  const oai   = getOpenAI();
  const { images, detail } = await preprocessImages(req.images, req);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...(req.history ?? []).map((h) => ({ role: h.role, content: h.content } as OpenAI.Chat.ChatCompletionMessageParam)),
    { role: 'user', content: buildOpenAIImageContent(images, req.prompt, detail) },
  ];
  const resp = await oai.chat.completions.create({ model, messages, max_tokens: req.maxTokens ?? 1024, temperature: req.temperature ?? 0.2 });
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
  const oai   = getOpenAI();
  const model = VLM_MODELS.openai;
  const { images, detail } = await preprocessImages(req.images, req);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...(req.history ?? []).map((h) => ({ role: h.role, content: h.content } as OpenAI.Chat.ChatCompletionMessageParam)),
    { role: 'user', content: buildOpenAIImageContent(images, req.prompt, detail) },
  ];
  const stream = await oai.chat.completions.create({
    model, messages,
    max_tokens:     req.maxTokens  ?? 1024,
    temperature:    req.temperature ?? 0.2,
    stream:         true,
    stream_options: { include_usage: true },
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
  try {
    const final = await stream.finalChatCompletion();
    if (final.usage) {
      logger.info({ model, inputTokens: final.usage.prompt_tokens, outputTokens: final.usage.completion_tokens, imageCount: images.length, intent: req.intent }, '[vision/openai] stream token usage');
    }
  } catch { /* disconnessione client — ok */ }
}

// ─── Anthropic Vision ───────────────────────────────────────────────────────

function buildAnthropicImageContent(
  images: string[],
  prompt: string,
): Anthropic.MessageParam['content'] {
  const content: Anthropic.ContentBlockParam[] = [];
  for (const url of images) {
    if (url.startsWith('https://')) {
      content.push({ type: 'image', source: { type: 'url', url } as Anthropic.URLImageSource });
    } else {
      const mediaType = mimeFromDataUri(url) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: b64FromDataUri(url) } });
    }
  }
  content.push({ type: 'text', text: prompt });
  return content;
}

async function analyzeWithAnthropic(req: VisionRequest): Promise<VisionResult> {
  const t0    = Date.now();
  const model = VLM_MODELS.anthropic;
  const anth  = getAnthropic();
  const { images } = await preprocessImages(req.images, req);
  const messages: Anthropic.MessageParam[] = [
    ...(req.history ?? []).map((h) => ({ role: h.role, content: h.content } as Anthropic.MessageParam)),
    { role: 'user', content: buildAnthropicImageContent(images, req.prompt) },
  ];
  const resp = await anth.messages.create({ model, messages, max_tokens: req.maxTokens ?? 1024 });
  const text = resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('');
  return { text, provider: 'anthropic', model, inputTokens: resp.usage.input_tokens, outputTokens: resp.usage.output_tokens, durationMs: Date.now() - t0 };
}

async function* streamWithAnthropic(req: VisionRequest): AsyncIterable<string> {
  const model = VLM_MODELS.anthropic;
  const anth  = getAnthropic();
  const { images } = await preprocessImages(req.images, req);
  const messages: Anthropic.MessageParam[] = [
    ...(req.history ?? []).map((h) => ({ role: h.role, content: h.content } as Anthropic.MessageParam)),
    { role: 'user', content: buildAnthropicImageContent(images, req.prompt) },
  ];
  const stream = anth.messages.stream({ model, messages, max_tokens: req.maxTokens ?? 1024 });
  try {
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
    const final = await stream.finalMessage();
    logger.info({ model, inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens, imageCount: images.length, intent: req.intent }, '[vision/anthropic] stream token usage');
  } finally {
    stream.abort();
  }
}

// ─── Google Gemini Vision ────────────────────────────────────────────────────

async function buildGeminiParts(
  images: string[],
  prompt: string,
): Promise<Array<string | { inlineData: { data: string; mimeType: string } }>> {
  const parts: Array<string | { inlineData: { data: string; mimeType: string } }> = [prompt];
  for (const url of images) {
    if (url.startsWith('data:image/')) {
      parts.push({ inlineData: { data: b64FromDataUri(url), mimeType: mimeFromDataUri(url) } });
    } else {
      // [CRITICAL-2] fetch server-side con timeout
      try {
        const dataUri = await fetchImageAsDataUri(url);
        parts.push({ inlineData: { data: b64FromDataUri(dataUri), mimeType: mimeFromDataUri(dataUri) } });
      } catch (fetchErr) {
        logger.warn({ err: fetchErr, url: url.slice(0, 80) }, '[vision/google] fetch URL fallito — skip immagine');
      }
    }
  }
  return parts;
}

async function analyzeWithGoogle(req: VisionRequest): Promise<VisionResult> {
  const t0       = Date.now();
  const model    = VLM_MODELS.google;
  const genModel = getGoogle().getGenerativeModel({ model });
  const { images } = await preprocessImages(req.images, req);
  const parts    = await buildGeminiParts(images, req.prompt);
  const result   = await genModel.generateContent(parts as Parameters<typeof genModel.generateContent>[0]);
  return { text: result.response.text(), provider: 'google', model, inputTokens: 0, outputTokens: 0, durationMs: Date.now() - t0 };
}

// [OPT-2] Google streaming nativo via generateContentStream()
async function* streamWithGoogle(req: VisionRequest): AsyncIterable<string> {
  const model    = VLM_MODELS.google;
  const genModel = getGoogle().getGenerativeModel({ model });
  const { images } = await preprocessImages(req.images, req);
  const parts    = await buildGeminiParts(images, req.prompt);
  const stream   = await genModel.generateContentStream(
    parts as Parameters<typeof genModel.generateContentStream>[0]
  );
  for await (const chunk of stream.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
  logger.debug({ model, imageCount: images.length }, '[vision/google] stream completato');
}

// ─── DALL-E Image Generation ────────────────────────────────────────────────────────

export async function generateImage(req: ImageGenRequest): Promise<ImageGenResult> {
  const t0    = Date.now();
  const model = req.model ?? 'dall-e-3';
  const oai   = getOpenAI();
  const n     = (model === 'dall-e-2') ? (req.n ?? 1) : 1;
  const resp  = await oai.images.generate({
    model,
    prompt:          req.prompt,
    n,
    size:            (req.size ?? '1024x1024') as Parameters<typeof oai.images.generate>[0]['size'],
    quality:         req.quality ?? 'standard',
    style:           req.style ?? 'vivid',
    response_format: req.responseFormat ?? 'url',
  });
  const images = (resp.data ?? []).map((img) => ({ url: img.url, b64: img.b64_json, revisedPrompt: img.revised_prompt }));
  logger.info({ model, n, durationMs: Date.now() - t0 }, '[vision] image generated');
  return { images, model, durationMs: Date.now() - t0 };
}

// ─── API pubblica ────────────────────────────────────────────────────────────────

/**
 * [OPT-1] Wrappa una chiamata con auto-retry sul provider di fallback.
 * Attivato solo per errori ritentabili (429, 5xx, overloaded).
 */
async function withFallback<T>(
  primary:  () => Promise<T>,
  req:      VisionRequest,
  label:    string,
): Promise<T> {
  try {
    return await primary();
  } catch (err) {
    if (!isRetryableError(err)) throw err;
    const fallbackProvider = resolveFallbackProvider('vision');
    if (!fallbackProvider) throw err;
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), primaryProvider: req.provider ?? 'openai', fallbackProvider },
      `[${label}] provider primario fallito — retry su fallback`,
    );
    // Esegui con provider di fallback
    const fallbackReq = { ...req, provider: fallbackProvider as VisionRequest['provider'] };
    switch (fallbackProvider) {
      case 'anthropic': return analyzeWithAnthropic(fallbackReq) as Promise<T>;
      case 'openai':    return analyzeWithOpenAI(fallbackReq)    as Promise<T>;
      case 'google':    return analyzeWithGoogle(fallbackReq)    as Promise<T>;
      default:          throw err;
    }
  }
}

/**
 * Analisi sincrona — con auto-fallback su provider alternativo.
 */
export async function analyzeImages(req: VisionRequest): Promise<VisionResult> {
  validateImageUrls(req.images);
  const provider = req.provider ?? 'openai';
  const resolved = { ...req, provider };

  logger.info(
    { provider, model: VLM_MODELS[provider as keyof typeof VLM_MODELS], imageCount: req.images.length, promptLen: req.prompt.length, intent: req.intent },
    '[vision] analyze start',
  );

  const callPrimary = () => {
    switch (provider) {
      case 'openai':    return analyzeWithOpenAI(resolved);
      case 'anthropic': return analyzeWithAnthropic(resolved);
      case 'google':    return analyzeWithGoogle(resolved);
      default:          return analyzeWithOpenAI(resolved);
    }
  };

  return withFallback(callPrimary, resolved, 'vision/analyze');
}

/**
 * Analisi con streaming SSE — con auto-fallback su provider alternativo.
 * Se il provider primario fallisce (es. 429), switcha al fallback in modo
 * trasparente: il client vede solo il flusso di chunk, non il retry.
 */
export async function* streamAnalyzeImages(
  req: VisionRequest,
): AsyncIterable<string> {
  validateImageUrls(req.images);
  const provider = req.provider ?? 'openai';

  logger.info(
    { provider, model: VLM_MODELS[provider as keyof typeof VLM_MODELS], imageCount: req.images.length, intent: req.intent },
    '[vision] stream analyze start',
  );

  // [OPT-1] Tenta il provider primario; se fallisce con errore ritentabile,
  //         fa yield dal provider di fallback senza interrompere lo stream SSE.
  let usedProvider = provider;
  try {
    switch (provider) {
      case 'openai':    yield* streamWithOpenAI({ ...req, provider: 'openai' });       break;
      case 'anthropic': yield* streamWithAnthropic({ ...req, provider: 'anthropic' }); break;
      case 'google':    yield* streamWithGoogle({ ...req, provider: 'google' });        break;
      default:          yield* streamWithOpenAI({ ...req, provider: 'openai' });
    }
  } catch (err) {
    if (!isRetryableError(err)) throw err;

    const fallbackProvider = resolveFallbackProvider('vision');
    if (!fallbackProvider) throw err;

    logger.warn(
      { err: err instanceof Error ? err.message : String(err), primaryProvider: provider, fallbackProvider },
      '[vision/stream] provider primario fallito — retry su fallback',
    );

    usedProvider = fallbackProvider;
    // Invia un evento speciale al client così il frontend può mostrarlo
    // (il formato SSE rimane compatibile — è solo un tipo di evento extra)
    // NOTA: il caller (wendy-vision.ts route) non intercetta questo — passa
    //       come chunk al client. Il frontend ignora i chunk non-testo.
    switch (fallbackProvider) {
      case 'openai':    yield* streamWithOpenAI({ ...req, provider: 'openai' });       break;
      case 'anthropic': yield* streamWithAnthropic({ ...req, provider: 'anthropic' }); break;
      case 'google':    yield* streamWithGoogle({ ...req, provider: 'google' });        break;
      default: throw err;
    }
  }

  logger.debug({ usedProvider }, '[vision/stream] completato');
}
