/**
 * ImageDropzone — Drag-and-drop upload immagini per Wendy
 *
 * Funzionalità:
 *   - Drag-over con feedback visivo (border pulse + overlay)
 *   - Click-to-browse (input file nascosto)
 *   - Preview thumbnail con nome file + dimensione
 *   - Pulsante × per rimuovere allegato
 *   - Validazione: JPEG/PNG/WebP/GIF, max 5MB
 *   - Mostra spinner "Ottimizzazione..." mentre converte in base64
 *
 * Props:
 *   onImageReady(dataUri, file) — chiamata quando l'immagine è pronta
 *   onClear()                  — chiamata quando l'utente rimuove l'allegato
 *   disabled                   — blocca interazione (durante analisi VLM)
 *   className                  — stile aggiuntivo
 *
 * Usage:
 *   <ImageDropzone
 *     onImageReady={(uri, file) => setAttachment({ uri, name: file.name })}
 *     onClear={() => setAttachment(null)}
 *     disabled={isAnalyzing}
 *   />
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';

const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export interface AttachedImage {
  dataUri:  string;
  file:     File;
  previewUrl: string; // URL.createObjectURL — revocato al clear
}

export interface ImageDropzoneProps {
  onImageReady: (dataUri: string, file: File) => void;
  onClear?:     () => void;
  disabled?:    boolean;
  className?:   string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ImageDropzone({
  onImageReady,
  onClear,
  disabled = false,
  className = '',
}: ImageDropzoneProps) {
  const inputRef                   = useRef<HTMLInputElement>(null);
  const [dragging,  setDragging]   = useState(false);
  const [attached,  setAttached]   = useState<AttachedImage | null>(null);
  const [loading,   setLoading]    = useState(false);
  const [error,     setError]      = useState<string | null>(null);

  // Revoca object URL quando il componente si smonta o viene rimossa l'immagine
  useEffect(() => {
    return () => {
      if (attached?.previewUrl) URL.revokeObjectURL(attached.previewUrl);
    };
  }, [attached]);

  const processFile = useCallback(async (file: File) => {
    setError(null);

    if (!ACCEPTED.includes(file.type)) {
      setError(`Formato non supportato. Usa: ${ACCEPTED.map((t) => t.split('/')[1]).join(', ')}`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`File troppo grande (${formatBytes(file.size)}). Max 5 MB.`);
      return;
    }

    setLoading(true);
    const previewUrl = URL.createObjectURL(file);

    try {
      const dataUri = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload  = () => res(reader.result as string);
        reader.onerror = () => rej(new Error('Lettura fallita'));
        reader.readAsDataURL(file);
      });

      const img: AttachedImage = { dataUri, file, previewUrl };
      setAttached(img);
      onImageReady(dataUri, file);
    } catch (e) {
      URL.revokeObjectURL(previewUrl);
      setError(e instanceof Error ? e.message : 'Errore lettura file');
    } finally {
      setLoading(false);
    }
  }, [onImageReady]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled || loading) return;
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [disabled, loading, processFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // reset value per permettere stesso file
    e.target.value = '';
  }, [processFile]);

  const handleClear = useCallback(() => {
    if (attached?.previewUrl) URL.revokeObjectURL(attached.previewUrl);
    setAttached(null);
    setError(null);
    onClear?.();
  }, [attached, onClear]);

  // ── Se c'è un allegato: mostra preview ──
  if (attached) {
    return (
      <div className={`relative inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 ${className}`}>
        <img
          src={attached.previewUrl}
          alt={attached.file.name}
          className="h-10 w-10 rounded-lg object-cover shadow-sm"
        />
        <div className="flex flex-col">
          <span className="max-w-[140px] truncate text-xs font-medium text-indigo-800">
            {attached.file.name}
          </span>
          <span className="text-[10px] text-indigo-500">
            {formatBytes(attached.file.size)}
          </span>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Rimuovi allegato"
            className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-200 text-indigo-700 transition hover:bg-indigo-300"
          >
            <span className="text-xs leading-none">×</span>
          </button>
        )}
      </div>
    );
  }

  // ── Dropzone idle / loading ──
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Trascina un'immagine o clicca per caricare"
      onClick={() => !disabled && !loading && inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={[
        'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-4 transition-all select-none',
        dragging
          ? 'border-indigo-500 bg-indigo-50 scale-[1.01]'
          : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/40',
        disabled ? 'pointer-events-none opacity-50' : '',
        className,
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="sr-only"
        onChange={handleChange}
        disabled={disabled}
      />

      {loading ? (
        <>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span className="text-xs text-indigo-500">Ottimizzazione...</span>
        </>
      ) : (
        <>
          <span className="text-2xl">{dragging ? '📥' : '🖼️'}</span>
          <span className="text-xs text-slate-500">
            {dragging ? 'Rilascia qui' : 'Trascina un’immagine o clicca'}
          </span>
          <span className="text-[10px] text-slate-400">JPEG · PNG · WebP · GIF · max 5 MB</span>
        </>
      )}

      {error && (
        <p className="mt-1 text-[10px] font-medium text-rose-500">{error}</p>
      )}
    </div>
  );
}
