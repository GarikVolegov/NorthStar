/**
 * ImageOptimizer — Middleware di ottimizzazione immagini
 *
 * Responsabilità:
 *   1. Downscale: ridimensiona a MAX_DIMENSION preservando aspect ratio
 *   2. Compress: converte a JPEG con qualità configurabile (risparmio banda)
 *   3. Detail selector: suggerisce 'low' vs 'high' in base alla dimensione
 *      e all'intent della richiesta (documento vs foto generica)
 *   4. Batch: processa array di immagini in parallelo (max CONCURRENCY)
 *   5. Stats: ritorna dimensioni originali vs compresse per logging/debug
 *
 * Dipendenza: `sharp` (npm i sharp) — libreria C++ ultra-veloce per Node.js
 * Fallback graceful: se sharp non è installato (dev env), le immagini
 *   passano non processate con un warning.
 *
 * Configurazione env:
 *   IMAGE_OPT_MAX_DIM=1568      # default: 1568px (limite consigliato OpenAI 'high')
 *   IMAGE_OPT_QUALITY=82        # qualità JPEG 0-100 (default 82)
 *   IMAGE_OPT_ENABLED=true      # false per disabilitare (test/dev)
 *   IMAGE_OPT_CONCURRENCY=3     # immagini processate in parallelo
 *
 * Strategia per use case:
 *   CV / documento strutturato  → max 2048px, qualità 88, detail='high'
 *   Screenshot UI / grafico     → max 1568px, qualità 82, detail='high'
 *   Foto profilo / generica     → max 1024px, qualità 75, detail='low'
 */

import { logger } from '../logger.js';

// ─── Configurazione ──────────────────────────────────────────────────────────────

const OPT_ENABLED     = process.env.IMAGE_OPT_ENABLED     !== 'false';
const MAX_DIM         = parseInt(process.env.IMAGE_OPT_MAX_DIM    ?? '1568', 10);
const JPEG_QUALITY    = parseInt(process.env.IMAGE_OPT_QUALITY    ?? '82',   10);
const CONCURRENCY     = parseInt(process.env.IMAGE_OPT_CONCURRENCY ?? '3',   10);

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImageIntent = 'document' | 'screenshot' | 'photo';

export interface OptimizeOptions {
  maxDim?:   number;      // px max per il lato lungo (default: MAX_DIM dall'env)
  quality?:  number;      // qualità JPEG 0-100 (default: JPEG_QUALITY)
  intent?:   ImageIntent; // influenza i preset
  forceJpeg?: boolean;    // converte anche PNG/WebP in JPEG (default: false)
}

export interface OptimizeResult {
  dataUri:        string;     // data:image/jpeg;base64,...  o originale
  originalBytes:  number;
  optimizedBytes: number;
  savedPct:       number;     // percentuale risparmio 0-100
  wasOptimized:   boolean;
  suggestedDetail: 'low' | 'high' | 'auto';
}

export interface BatchOptimizeResult {
  images:       OptimizeResult[];
  totalSaved:   number;       // byte totali risparmiati
  totalSavedPct: number;      // % media
  durationMs:   number;
}

// ─── Preset per intent ────────────────────────────────────────────────────────────

const INTENT_PRESETS: Record<ImageIntent, { maxDim: number; quality: number; detail: 'low' | 'high' }> = {
  document:   { maxDim: 2048, quality: 88, detail: 'high' },  // CV, PDF, fattura
  screenshot: { maxDim: 1568, quality: 82, detail: 'high' },  // UI, grafico, RIASEC
  photo:      { maxDim: 1024, quality: 75, detail: 'low'  },  // avatar, foto generica
};

// ─── Lazy import di sharp ────────────────────────────────────────────────────────────
// Non importiamo a livello di modulo per non bloccare il server se sharp
// non è installato (es. dev env senza dipendenze native).

type SharpInstance = {
  metadata: () => Promise<{ width?: number; height?: number; format?: string }>;
  resize: (w: number, h: number, opts?: object) => SharpInstance;
  jpeg: (opts: { quality: number }) => SharpInstance;
  toBuffer: () => Promise<Buffer>;
};
type SharpFn = (input: Buffer) => SharpInstance;

let _sharp: SharpFn | null | 'unavailable' = null;

async function getSharp(): Promise<SharpFn | null> {
  if (_sharp === 'unavailable') return null;
  if (_sharp) return _sharp;
  try {
    const mod = await import('sharp');
    _sharp = (mod.default ?? mod) as unknown as SharpFn;
    return _sharp;
  } catch {
    logger.warn('[image-optimizer] sharp non trovato — ottimizzazione disabilitata');
    _sharp = 'unavailable';
    return null;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isDataUri(s: string): boolean {
  return s.startsWith('data:image/');
}

function dataUriToBuffer(uri: string): Buffer {
  const base64 = uri.split(',')[1] ?? '';
  return Buffer.from(base64, 'base64');
}

function bufferToJpegDataUri(buf: Buffer): string {
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

function bytesFromDataUri(uri: string): number {
  const base64 = uri.split(',')[1] ?? '';
  // Stima: ogni 4 caratteri base64 = 3 byte
  return Math.floor(base64.length * 0.75);
}

/** Scala proporzionalmente: ritorna [newW, newH] */
function scaleDown(w: number, h: number, maxDim: number): [number, number] {
  if (w <= maxDim && h <= maxDim) return [w, h];
  const ratio = Math.min(maxDim / w, maxDim / h);
  return [Math.round(w * ratio), Math.round(h * ratio)];
}

// ─── Core: ottimizza una singola immagine ────────────────────────────────────────

/**
 * Ottimizza un singolo data-URI.
 * Gli URL https:// vengono restituiti invariati (li scarica il provider).
 */
export async function optimizeImage(
  imageUri: string,
  opts:     OptimizeOptions = {},
): Promise<OptimizeResult> {
  const originalBytes = isDataUri(imageUri) ? bytesFromDataUri(imageUri) : 0;

  // Pass-through per URL pubblici (scaricati direttamente dal VLM)
  if (!isDataUri(imageUri)) {
    return {
      dataUri:         imageUri,
      originalBytes:   0,
      optimizedBytes:  0,
      savedPct:        0,
      wasOptimized:    false,
      suggestedDetail: 'auto',
    };
  }

  const intent   = opts.intent ?? 'screenshot';
  const preset   = INTENT_PRESETS[intent];
  const maxDim   = opts.maxDim  ?? preset.maxDim;
  const quality  = opts.quality ?? preset.quality;

  if (!OPT_ENABLED) {
    return {
      dataUri:         imageUri,
      originalBytes,
      optimizedBytes:  originalBytes,
      savedPct:        0,
      wasOptimized:    false,
      suggestedDetail: preset.detail,
    };
  }

  const sharp = await getSharp();
  if (!sharp) {
    // Graceful degradation: sharp non disponibile
    return {
      dataUri:         imageUri,
      originalBytes,
      optimizedBytes:  originalBytes,
      savedPct:        0,
      wasOptimized:    false,
      suggestedDetail: preset.detail,
    };
  }

  try {
    const inputBuf = dataUriToBuffer(imageUri);
    const img      = sharp(inputBuf);
    const meta     = await img.metadata();
    const w        = meta.width  ?? maxDim;
    const h        = meta.height ?? maxDim;
    const [newW, newH] = scaleDown(w, h, maxDim);

    const outputBuf = await img
      .resize(newW, newH, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();

    const optimizedBytes = outputBuf.length;
    const savedPct = originalBytes > 0
      ? Math.round((1 - optimizedBytes / originalBytes) * 100)
      : 0;

    // Scegli detail in base alla dimensione finale
    const suggestedDetail: 'low' | 'high' =
      newW > 768 || newH > 768 ? 'high' : 'low';

    logger.debug({
      intent,
      originalBytes,
      optimizedBytes,
      savedPct,
      dims: `${w}x${h} → ${newW}x${newH}`,
    }, '[image-optimizer] ottimizzata');

    return {
      dataUri:         bufferToJpegDataUri(outputBuf),
      originalBytes,
      optimizedBytes,
      savedPct,
      wasOptimized:    true,
      suggestedDetail,
    };
  } catch (err) {
    logger.warn({ err }, '[image-optimizer] errore processing — pass-through');
    return {
      dataUri:         imageUri,
      originalBytes,
      optimizedBytes:  originalBytes,
      savedPct:        0,
      wasOptimized:    false,
      suggestedDetail: preset.detail,
    };
  }
}

// ─── Batch (parallelismo con concurrency cap) ──────────────────────────────────────

/**
 * Processa un batch di immagini con concorrenza limitata.
 * Evita di saturare la CPU con molte immagini grosse in parallelo.
 */
export async function optimizeImageBatch(
  images: string[],
  opts:   OptimizeOptions = {},
): Promise<BatchOptimizeResult> {
  const t0 = Date.now();
  const results: OptimizeResult[] = new Array(images.length);

  // Divide in chunk di CONCURRENCY
  for (let i = 0; i < images.length; i += CONCURRENCY) {
    const batch = images.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((img) => optimizeImage(img, opts)),
    );
    batchResults.forEach((r, j) => { results[i + j] = r; });
  }

  const totalOriginal  = results.reduce((s, r) => s + r.originalBytes,  0);
  const totalOptimized = results.reduce((s, r) => s + r.optimizedBytes, 0);
  const totalSaved     = totalOriginal - totalOptimized;
  const totalSavedPct  = totalOriginal > 0
    ? Math.round((totalSaved / totalOriginal) * 100)
    : 0;

  logger.info({
    count:       images.length,
    totalSaved,
    totalSavedPct,
    durationMs:  Date.now() - t0,
  }, '[image-optimizer] batch completato');

  return { images: results, totalSaved, totalSavedPct, durationMs: Date.now() - t0 };
}
