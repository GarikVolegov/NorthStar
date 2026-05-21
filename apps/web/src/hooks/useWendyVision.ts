/**
 * useWendyVision — Hook React per capacità visive di Wendy
 *
 * Fornisce:
 *   analyzeImages()  — invia immagini al VLM e riceve risposta streaming
 *   generateImage()  — genera immagine con DALL-E
 *   uploadAndAnalyze() — carica file locale, converte in base64, analizza
 *
 * Integrazione con useWendyChat:
 *   const vision = useWendyVision({ onChunk: (c) => wendy.appendChunk(c) });
 *   await vision.uploadAndAnalyze(file, 'Estrai le mie competenze dal CV');
 *
 * Formati supportati:
 *   - Immagini: JPEG, PNG, WebP, GIF (max 5MB)
 *   - Screenshot PDF (il frontend converte PDF page → canvas → PNG base64)
 */

import { useCallback, useState } from 'react';
import { postJson } from '@/lib/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export type VisionProvider = 'openai' | 'anthropic' | 'google';
export type ImageDetail    = 'low' | 'high' | 'auto';

export interface VisionAnalysisOptions {
  provider?:    VisionProvider; // default 'openai'
  detail?:      ImageDetail;    // default 'auto'
  maxTokens?:   number;         // default 1024
  history?:     Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface GenerateImageOptions {
  model?:   'dall-e-3' | 'dall-e-2' | 'gpt-image-1';  // default 'dall-e-3'
  size?:    '1024x1024' | '1792x1024' | '1024x1792';   // default '1024x1024'
  quality?: 'standard' | 'hd';
  style?:   'vivid' | 'natural';
}

export interface GeneratedImage {
  url?:           string;
  b64?:           string;
  revisedPrompt?: string;
}

export interface UseWendyVisionReturn {
  isAnalyzing:    boolean;
  isGenerating:   boolean;
  visionError:    string | null;
  analyzeImages:  (imageUrls: string[], prompt: string, opts?: VisionAnalysisOptions) => Promise<string>;
  generateImage:  (prompt: string, opts?: GenerateImageOptions) => Promise<GeneratedImage[]>;
  uploadAndAnalyze: (file: File, prompt: string, opts?: VisionAnalysisOptions) => Promise<string>;
  clearVisionError: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

async function fileToBase64DataUri(file: File): Promise<string> {
  if (!ACCEPTED_MIME_TYPES.has(file.type)) {
    throw new Error(`Formato non supportato: ${file.type}. Usa JPEG, PNG, WebP o GIF.`);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Immagine troppo grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.`);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Errore nella lettura del file'));
    reader.readAsDataURL(file);
  });
}

function readErrorMessage(value: unknown, fallback: string): string {
  if (value && typeof value === 'object' && 'error' in value) {
    const error = (value as { error?: unknown }).error;
    if (typeof error === 'string') return error;
  }
  return fallback;
}

function readVisionChunk(value: unknown): string {
  if (typeof value !== 'object' || value === null) return '';
  const record = value as {
    error?: unknown;
    choices?: Array<{ delta?: { content?: unknown } }>;
  };
  if (typeof record.error === 'string') {
    throw new Error(record.error);
  }
  const content = record.choices?.[0]?.delta?.content;
  return typeof content === 'string' ? content : '';
}

/**
 * Legge uno stream SSE da /api/v1/ai/vision/analyze e aggrega i chunk.
 * Compatibile con il formato { choices: [{ delta: { content } }] }
 */
async function readVisionSSE(
  response: Response,
  onChunk?: (chunk: string) => void,
): Promise<string> {
  const reader  = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer    = '';
  let fullText  = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') return fullText;

      try {
        const data = JSON.parse(raw) as unknown;
        const chunk = readVisionChunk(data);
        if (chunk) {
          fullText += chunk;
          onChunk?.(chunk);
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue; // ignora line incomplete
        throw e;
      }
    }
  }
  return fullText;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseWendyVisionOptions {
  apiBaseUrl?: string;
  /** Callback chiamato per ogni chunk di testo ricevuto dal VLM */
  onChunk?:    (chunk: string) => void;
}

export function useWendyVision(options: UseWendyVisionOptions = {}): UseWendyVisionReturn {
  const {
    apiBaseUrl = '/api/v1/ai/vision',
    onChunk,
  } = options;

  const [isAnalyzing,  setIsAnalyzing]  = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [visionError,  setVisionError]  = useState<string | null>(null);

  // ── analyzeImages ───────────────────────────────────────────────────────────
  const analyzeImages = useCallback(async (
    imageUrls: string[],
    prompt:    string,
    opts:      VisionAnalysisOptions = {},
  ): Promise<string> => {
    setIsAnalyzing(true);
    setVisionError(null);

    try {
      const resp = await fetch(`${apiBaseUrl}/analyze`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          images:      imageUrls,
          prompt,
          provider:    opts.provider    ?? 'openai',
          detail:      opts.detail      ?? 'auto',
          maxTokens:   opts.maxTokens   ?? 1024,
          history:     opts.history     ?? [],
        }),
      });

      if (!resp.ok) {
        const err = (await resp.json().catch(() => ({
          error: `HTTP ${resp.status}`,
        }))) as unknown;
        throw new Error(readErrorMessage(err, 'Errore analisi immagine'));
      }

      return await readVisionSSE(resp, onChunk);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore vision';
      setVisionError(msg);
      throw err;
    } finally {
      setIsAnalyzing(false);
    }
  }, [apiBaseUrl, onChunk]);

  // ── uploadAndAnalyze ────────────────────────────────────────────────────────
  const uploadAndAnalyze = useCallback(async (
    file:   File,
    prompt: string,
    opts:   VisionAnalysisOptions = {},
  ): Promise<string> => {
    const dataUri = await fileToBase64DataUri(file);
    return analyzeImages([dataUri], prompt, opts);
  }, [analyzeImages]);

  // ── generateImage ────────────────────────────────────────────────────────────
  const generateImage = useCallback(async (
    prompt: string,
    opts:   GenerateImageOptions = {},
  ): Promise<GeneratedImage[]> => {
    setIsGenerating(true);
    setVisionError(null);

    try {
      const data = await postJson<{ images?: GeneratedImage[] }>(
        `${apiBaseUrl}/generate`,
        {
          prompt,
          model:   opts.model   ?? 'dall-e-3',
          size:    opts.size    ?? '1024x1024',
          quality: opts.quality ?? 'standard',
          style:   opts.style   ?? 'vivid',
        },
      );
      return data.images ?? [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore generazione';
      setVisionError(msg);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, [apiBaseUrl]);

  return {
    isAnalyzing,
    isGenerating,
    visionError,
    analyzeImages,
    generateImage,
    uploadAndAnalyze,
    clearVisionError: () => setVisionError(null),
  };
}
