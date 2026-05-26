/**
 * discovery_sources — tabella per le fonti RSS gestite dall'admin.
 *
 * Ogni riga rappresenta una fonte RSS configurabile:
 *   - enabled:     true/false — abilita/disabilita senza eliminare
 *   - feedUrl:     URL del feed RSS/Atom
 *   - itemType:    tipo di item (news | opportunity | formation | growth | sector_trend)
 *   - sector:      settore principale
 *   - category:    categoria interna
 *   - itemsPerRun: quanti item raccogliere per run
 *   - lastFetchAt: quando è stato fetchato l'ultima volta
 *   - lastError:   ultimo errore (se presente)
 *
 * USAGE:
 *   Admin può aggiungere/modificare/disabilitare fonti dalla UI
 *   senza necessità di deploy.
 *
 *   Il collector legge questa tabella a ogni run e processa
 *   solo le fonti con enabled=true.
 */
import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const discoverySourcesTable = pgTable("discovery_sources", {
  id:          serial("id").primaryKey(),

  // Identificazione
  name:        text("name").notNull(),          // es. "Wired Italia"
  feedUrl:     text("feed_url").notNull().unique(),
  description: text("description"),             // note admin opzionali

  // Classificazione
  itemType:    text("item_type").notNull().default("news"),  // ItemType
  sector:      text("sector").notNull().default("General"),
  category:    text("category").notNull().default("news"),
  language:    text("language").default("it"),               // "it" | "en"

  // Configurazione
  enabled:     boolean("enabled").notNull().default(true),
  priority:    boolean("priority").notNull().default(false),
  sourceType:  text("source_type").notNull().default("rss"),
  scrapingUrl: text("scraping_url"),
  scrapingSelector: text("scraping_selector"),
  itemsPerRun: integer("items_per_run").notNull().default(6),

  // Metadata operativo
  lastFetchAt: timestamp("last_fetch_at"),
  lastError:   text("last_error"),
  totalFetched:integer("total_fetched").notNull().default(0),

  // Audit
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
});

export type DiscoverySource    = typeof discoverySourcesTable.$inferSelect;
export type NewDiscoverySource = typeof discoverySourcesTable.$inferInsert;
