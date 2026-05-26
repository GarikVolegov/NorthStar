interface CorroborationInput {
  urlHash: string;
  title: string;
  collectorSource: string;
}

const STOP_WORDS = new Set([
  "alla",
  "allo",
  "come",
  "con",
  "dai",
  "dal",
  "dalla",
  "delle",
  "del",
  "degli",
  "dei",
  "gli",
  "the",
  "and",
  "for",
  "from",
  "into",
  "that",
  "this",
  "with",
  "per",
  "tra",
  "una",
  "uno",
  "sul",
  "sulla",
  "nel",
  "nella",
]);

function tokenizeTitle(title: string): Set<string> {
  const normalized = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return new Set(
    normalized
      .split(/[^a-z0-9]+/i)
      .filter((word) => word.length >= 4 && !STOP_WORDS.has(word)),
  );
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const token of a) {
    if (b.has(token)) count++;
  }
  return count;
}

export function computeCorroboration(items: CorroborationInput[]): Map<string, number> {
  const parent = items.map((_, index) => index);
  const tokens = items.map((item) => tokenizeTitle(item.title));

  function find(index: number): number {
    if (parent[index] !== index) parent[index] = find(parent[index]!);
    return parent[index]!;
  }

  function union(a: number, b: number): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  }

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (intersectionSize(tokens[i]!, tokens[j]!) >= 3) {
        union(i, j);
      }
    }
  }

  const sourcesByRoot = new Map<number, Set<string>>();
  items.forEach((item, index) => {
    const root = find(index);
    const sources = sourcesByRoot.get(root) ?? new Set<string>();
    sources.add(item.collectorSource.trim().toLowerCase());
    sourcesByRoot.set(root, sources);
  });

  const result = new Map<string, number>();
  items.forEach((item, index) => {
    result.set(item.urlHash, sourcesByRoot.get(find(index))?.size ?? 1);
  });
  return result;
}
