const IT_CORRECTIONS: Array<[RegExp, string]> = [
  [/\bstqi\b/gi, "stai"],
  [/\bcariera\b/gi, "carriera"],
  [/\blavorro\b/gi, "lavoro"],
  [/\bobiettivio\b/gi, "obiettivo"],
  [/\bimpresaa\b/gi, "impresa"],
  [/\bconsigil\b/gi, "consiglio"],
];

export function normalizeInput(text: string): string {
  let result = text;
  for (const [pattern, replacement] of IT_CORRECTIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
