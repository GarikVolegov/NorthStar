let interFontData: ArrayBuffer | null = null;

const FONT_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-700-normal.woff";

export async function getInterFont(): Promise<ArrayBuffer> {
  if (interFontData) return interFontData;
  const res = await fetch(FONT_URL);
  if (!res.ok) throw new Error(`Failed to fetch font: ${res.status}`);
  interFontData = await res.arrayBuffer();
  return interFontData;
}
