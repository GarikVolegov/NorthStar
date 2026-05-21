export type ItemType = "news" | "opportunity" | "formation" | "growth" | "sector_trend";

export interface RawItem {
  type: ItemType;
  title: string;
  url: string;
  source: string;
  summary: string;
  imageUrl?: string | undefined;
  publishedAt?: Date | undefined;
  category: string;
  sectorNames: string[];
  collectorSource: string;
  searchQuery?: string | undefined;
}

export interface RSSEntry {
  title: string;
  url: string;
  summary: string;
  imageUrl?: string | undefined;
  publishedAt?: Date | undefined;
}

export interface CollectorSource {
  name: string;
  fn: () => Promise<RawItem[]>;
}
