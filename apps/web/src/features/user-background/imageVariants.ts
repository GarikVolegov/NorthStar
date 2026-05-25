const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_VARIANT_BYTES = 1_850_000;
const TARGETS = {
  desktop: [
    { width: 1920, height: 1080 },
    { width: 1600, height: 900 },
    { width: 1280, height: 720 },
  ],
  mobile: [
    { width: 1080, height: 1920 },
    { width: 900, height: 1600 },
    { width: 720, height: 1280 },
  ],
} as const;
const QUALITIES = [0.82, 0.72, 0.62, 0.52] as const;

export function dataUrlBytes(dataUrl: string): number {
  return dataUrl.length;
}

export function isUnderServerVariantLimit(dataUrl: string): boolean {
  return dataUrlBytes(dataUrl) <= MAX_VARIANT_BYTES;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Lettura immagine fallita."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Lettura immagine fallita."));
    reader.readAsDataURL(file);
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  targetW: number,
  targetH: number,
) {
  const srcRatio = img.width / img.height;
  const dstRatio = targetW / targetH;
  const drawH = srcRatio > dstRatio ? targetH : targetW / srcRatio;
  const drawW = srcRatio > dstRatio ? targetH * srcRatio : targetW;
  ctx.drawImage(img, (targetW - drawW) / 2, (targetH - drawH) / 2, drawW, drawH);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossibile decodificare l'immagine."));
    img.src = src;
  });
}

async function createVariant(
  source: string,
  targets: ReadonlyArray<{ width: number; height: number }>,
): Promise<string> {
  const img = await loadImage(source);
  for (const target of targets) {
    for (const quality of QUALITIES) {
      const canvas = document.createElement("canvas");
      canvas.width = target.width;
      canvas.height = target.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas non disponibile per preparare lo sfondo.");
      drawCover(ctx, img, target.width, target.height);
      const variant = canvas.toDataURL("image/webp", quality);
      if (isUnderServerVariantLimit(variant)) return variant;
    }
  }
  throw new Error("Immagine troppo grande: scegli una foto meno dettagliata o piu leggera.");
}

async function estimateLuma(source: string): Promise<number | undefined> {
  try {
    const img = await loadImage(source);
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    drawCover(ctx, img, 16, 16);
    const pixels = ctx.getImageData(0, 0, 16, 16).data;
    let total = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] ?? 0;
      const green = pixels[index + 1] ?? 0;
      const blue = pixels[index + 2] ?? 0;
      total += (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    }
    return Number((total / (pixels.length / 4)).toFixed(3));
  } catch {
    return undefined;
  }
}

export async function createUserBackgroundVariants(file: File): Promise<{
  dataUrl: string;
  dataUrlMobile: string;
  luma?: number;
}> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Carica un file immagine.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Immagine troppo grande: massimo 5 MB.");
  }
  const source = await readFileAsDataUrl(file);
  const [dataUrl, dataUrlMobile, luma] = await Promise.all([
    createVariant(source, TARGETS.desktop),
    createVariant(source, TARGETS.mobile),
    estimateLuma(source),
  ]);
  return { dataUrl, dataUrlMobile, ...(luma !== undefined ? { luma } : {}) };
}
