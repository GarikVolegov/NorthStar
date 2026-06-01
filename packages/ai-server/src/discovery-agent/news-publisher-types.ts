import type { RawItem } from "./collector-types";

export interface MissingNewsCoverage {
  sectorId: number;
  sectorName: string;
  realArticles: number;
  needed: number;
}

export interface NewsPublisherResult {
  transferred: number;
  /** @deprecated Temporary compatibility: synthetic seeds are no longer generated. */
  seeded: number;
  missingCoverage: MissingNewsCoverage[];
  durationMs: number;
}

export interface NewsRewriteInput {
  title: string;
  source: string;
  summary: string;
  insightText: string | null;
  sectorNames: string[];
  publishedAt: Date | null;
}

export interface NewsRewriteOutput {
  preview: string;
  content: string;
}

export interface PublishableItem extends RawItem {
  urlHash: string;
  insightText: string | null;
  relevanceScore: number;
}

export type NewsInsertRow = {
  title: string;
  url: string;
  urlHash: string;
  source: string;
  summary: string;
  imageUrl: string | null;
  content: string;
  publishedAt: Date;
  sectorNames: string[];
  category: string;
  relevanceScore: number;
  searchQuery: string | undefined;
};
