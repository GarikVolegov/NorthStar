/**
 * ai/vision.ts — Vision Language Model (VLM) facade
 *
 * Fornisce:
 *   analyzeImages()        — analisi sincrona (risposta completa)
 *   streamAnalyzeImages()  — streaming chunk-by-chunk (SSE)
 *   generateImage()        — generazione immagini con DALL-E
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
 * Fix v2.1:
 *   [CRITICAL-1] image-optimizer integrato nella pipeline (resize + compress
 *                prima di ogni chiamata VLM — risparmio costi fino a 4×)
 *   [CRITICAL-2] Google: URL pubblici ora fetchati server-side (fix immagini
 *                sempre sbagliate su Gemini con URL https://)
 *   [CRITICAL-3] Anthropic stream: aggiunto try/finally con stream.abort()
 *                per cleanup corretto se il client si disconnette
 *   [BONUS]      Token usage loggato dopo stream OpenAI (finalChatCompletion)
 *   [BONUS]      Timeout 10s su fetch immagini remote (AbortSignal.timeout)
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../logger.js';
import { optimizeImageBatch } from './image-optimizer.js';
import type {
  VisionRequest, VisionResult,
  ImageGenRequest, ImageGenResult,
  TextPart, ImagePart,
} from './types.js';

// ─── Configurazione ──────────────────────────────────────────────────────────────

const MAX_IMAGES_PER_REQUEST = 5;

/** Timeout in ms per fetch di immagini remote (SSRF + hanging requests) */
const FETCH_IMAGE_TIMEOUT_MS = 10_000;

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

// ─── [FIX CRITICAL-2] Fetch sicuro di URL remoti ─────────────────────────────────
// Gemini non accetta URL diretti: scarica server-side con timeout anti-hang.
// Usato anche da Anthropic se si vuole pre-processare gli URL.

async function fetchImageAsDataUri(url: string): Promise<string> {
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_IMAGE_TIMEOUT_MS),
    headers: { 'User-Agent': 'NorthStar-Vision/2.1' },
  });

  if (!resp.ok) {
    throw new Error(`Impossibile scaricare immagine: HTTP ${resp.status} — ${url.slice(0, 80)}`);
  }

  const contentType = resp.headers.get('content-type') ?? 'image/jpeg';
  // Accettiamo solo MIME immagine
  if (!contentType.startsWith('image/')) {
    throw new Error(`Content-Type non immagine ("${contentType}") — ${url.slice(0, 80)}`);
  }

  const buf    = Buffer.from(await resp.arrayBuffer());
  const b64    = buf.toString('base64');
  return `data:${contentType};base64,${b64}`;
}

// ─── [FIX CRITICAL-1] Image optimizer pipeline ───────────────────────────────────
// Comprime e ridimensiona le immagini PRIMA di mandarle al VLM.
// - Risparmio costi: un'immagine 4096×4096 → 1568px riduce i tile OpenAI da ~17 a ~4
// - Restituisce anche il detail suggerito in base alle dimensioni finali

async function preprocessImages(
  images: string[],
  req:    Pick<VisionRequest, 'intent' | 'detail'>,
): Promise<{ images: string[]; detail: 'low' | 'high' | 'auto' }> {
  const batch = await optimizeImageBatch(images, {
    intent: req.intent ?? 'screenshot',
  });

  const processedImages = batch.images.map((r) => r.dataUri);

  // Usa il detail suggerito dall'optimizer (basato sulle dimensioni finali)
  // ma solo se l'utente non ha specificato esplicitamente
  const suggestedDetail = batch.images[0]?.suggestedDetail ?? 'auto';
  const detail = req.detail ?? suggestedDetail;

  if (batch.totalSaved > 0) {
    logger.info({
      savedBytes:   batch.totalSaved,
      savedPct:     batch.totalSavedPct,
      durationMs:   batch.durationMs,
      intent:       req.intent ?? 'screenshot',
      detailChosen: detail,
    }, '[vision] image-optimizer: payload ridotto');
  }

  return { images: processedImages, detail };
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

  const { images, detail } = await preprocessImages(req.images, req);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  for (const h of req.history ?? []) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({
    role:    'user',
    content: buildOpenAIImageContent(images, req.prompt, detail),
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

  // [FIX CRITICAL-1] ottimizza immagini prima del VLM
  const { images, detail } = await preprocessImages(req.images, req);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  for (const h of req.history ?? []) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({
    role:    'user',
    content: buildOpenAIImageContent(images, req.prompt, detail),
  });

  const stream = await oai.chat.completions.create({
    model,
    messages,
    max_tokens:  req.maxTokens  ?? 1024,
    temperature: req.temperature ?? 0.2,
    stream:      true,
    stream_options: { include_usage: true }, // [BONUS] token usage post-stream
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }

  // [BONUS] Logga token usage dopo che lo stream è completo
  try {
    const final = await stream.finalChatCompletion();
    if (final.usage) {
      logger.info({
        model,
        inputTokens:  final.usage.prompt_tokens,
        outputTokens: final.usage.completion_tokens,
        imageCount:   images.length,
        intent:       req.intent,
      }, '[vision/openai] stream token usage');
    }
  } catch {
    // finalChatCompletion può fallire se il client si è disconnesso — ok
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

  // [FIX CRITICAL-1] ottimizza immagini prima del VLM
  const { images } = await preprocessImages(req.images, req);

  const messages: Anthropic.MessageParam[] = [];
  for (const h of req.history ?? []) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({
    role:    'user',
    content: buildAnthropicImageContent(images, req.prompt),
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

  // [FIX CRITICAL-1] ottimizza immagini prima del VLM
  const { images } = await preprocessImages(req.images, req);

  const messages: Anthropic.MessageParam[] = [];
  for (const h of req.history ?? []) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({
    role:    'user',
    content: buildAnthropicImageContent(images, req.prompt),
  });

  // [FIX CRITICAL-3] Wrap stream in try/finally per cleanup garantito.
  // Senza questo, se il client si disconnette mentre il generatore è appeso
  // su `for await`, lo stream Anthropic rimane aperto e consuma banda.
  const stream = anth.messages.stream({
    model,
    messages,
    max_tokens: req.maxTokens ?? 1024,
  });

  try {
    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }

    // [BONUS] Logga token usage dopo message_stop
    const final = await stream.finalMessage();
    logger.info({
      model,
      inputTokens:  final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
      imageCount:   images.length,
      intent:       req.intent,
    }, '[vision/anthropic] stream token usage');

  } finally {
    // Garantisce la chiusura della connessione HTTP anche in caso di:
    // - errore nel generatore chiamante
    // - break anticipato (client disconnesso)
    // - eccezione durante yield
    stream.abort();
  }
}

// ─── Google Gemini Vision ─────────────────────────────────────────────────────────

async function analyzeWithGoogle(req: VisionRequest): Promise<VisionResult> {
  const t0    = Date.now();
  const model = VLM_MODELS.google;
  const gen   = getGoogle();
  const genModel = gen.getGenerativeModel({ model });

  // [FIX CRITICAL-1] ottimizza immagini prima del VLM
  const { images: optimizedImages } = await preprocessImages(req.images, req);

  const parts: Array<string | { inlineData: { data: string; mimeType: string } }> = [
    req.prompt,
  ];

  for (const url of optimizedImages) {
    if (url.startsWith('data:image/')) {
      // Già base64 (dopo optimizer o input diretto)
      parts.push({
        inlineData: {
          data:     b64FromDataUri(url),
          mimeType: mimeFromDataUri(url),
        },
      });
    } else {
      // [FIX CRITICAL-2] URL pubblici: fetch server-side con timeout anti-hang.
      // Prima del fix: url passava come stringa → Gemini vedeva il testo dell'URL.
      // Ora: scarica l'immagine e la invia come inlineData base64.
      logger.debug({ url: url.slice(0, 80) },
        '[vision/google] scarico URL pubblico server-side');
      try {
        const dataUri = await fetchImageAsDataUri(url);
        parts.push({
          inlineData: {
            data:     b64FromDataUri(dataUri),
            mimeType: mimeFromDataUri(dataUri),
          },
        });
      } catch (fetchErr) {
        logger.warn({ err: fetchErr, url: url.slice(0, 80) },
          '[vision/google] fetch URL fallito — skip immagine');
        // Skippa l'immagine fallita ma continua con le altre
      }
    }
  }

  const result = await genModel.generateContent(
    parts as Parameters<typeof genModel.generateContent>[0]
  );
  const text = result.response.text();

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
    intent:     req.intent,
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
    intent:     req.intent,
  }, '[vision] stream analyze start');

  switch (provider) {
    case 'openai':    yield* streamWithOpenAI(req);    break;
    case 'anthropic': yield* streamWithAnthropic(req); break;
    case 'google':    {
      // Google SDK Node non ha streaming nativo — simula con singola call.
      // TODO: migrare a generateContentStream() quando stabile
      const result = await analyzeWithGoogle(req);
      yield result.text;
      break;
    }
    default:          yield* streamWithOpenAI(req);
  }
}
