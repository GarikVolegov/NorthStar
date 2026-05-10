/**
 * city-router.ts — GET /api/city/autocomplete
 *
 * Proxy verso Nominatim (OpenStreetMap) per autocomplete città.
 * Non richiede auth — è una route pubblica.
 *
 * Query params:
 *   q    — stringa di ricerca (es. "Roma", "Milan")
 *   lang — lingua risultati (default: "it")
 *
 * Risposta:
 * [
 *   { placeId: string, label: string, city: string, country: string },
 *   ...
 * ]
 *
 * Rate limit Nominatim: max 1 req/s, User-Agent obbligatorio.
 * Per produzione considerare un servizio self-hosted o geocoding API dedicata.
 */
import { Router } from "express";

export const cityRouter = Router();

// Semplice in-memory cache per ridurre chiamate a Nominatim
const cache = new Map<string, { data: CityResult[]; ts: number }>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minuti

interface NominatimResult {
  place_id: number;
  osm_type: string;
  osm_id: number;
  display_name: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
  type: string;
  class: string;
}

interface CityResult {
  placeId: string;
  label: string;      // label completa per display (es. "Roma, Lazio, Italia")
  city: string;       // nome città breve (es. "Roma") — salvato in users.city
  country: string;    // paese (es. "Italia")
}

function buildLabel(addr: NominatimResult["address"]): string {
  const parts: string[] = [];
  const cityName = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? addr.county ?? "";
  if (cityName) parts.push(cityName);
  if (addr.state) parts.push(addr.state);
  if (addr.country) parts.push(addr.country);
  return parts.join(", ");
}

function extractCityName(addr: NominatimResult["address"]): string {
  return addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? addr.county ?? "";
}

cityRouter.get("/autocomplete", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const lang = (req.query.lang as string | undefined) ?? "it";

  if (!q || q.length < 2) {
    res.json([]);
    return;
  }

  const cacheKey = `${q.toLowerCase()}:${lang}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    res.json(cached.data);
    return;
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "7");
    url.searchParams.set("accept-language", lang);
    // Filtra solo città/comuni per risultati pertinenti
    url.searchParams.set("featuretype", "city");

    const response = await fetch(url.toString(), {
      headers: {
        // Nominatim richiede User-Agent identificativo
        "User-Agent": "NorthStar/1.0 (northstar-app; contact@northstar.app)",
        "Accept-Language": lang,
      },
    });

    if (!response.ok) {
      res.status(502).json({ error: "Errore Nominatim" });
      return;
    }

    const raw: NominatimResult[] = await response.json();

    // Deduplica per label e filtra risultati senza nome città
    const seen = new Set<string>();
    const results: CityResult[] = [];

    for (const item of raw) {
      const cityName = extractCityName(item.address);
      if (!cityName) continue;

      const label = buildLabel(item.address);
      if (seen.has(label)) continue;
      seen.add(label);

      results.push({
        placeId: `${item.osm_type.charAt(0).toUpperCase()}${item.osm_id}`,
        label,
        city: cityName,
        country: item.address.country ?? "",
      });
    }

    cache.set(cacheKey, { data: results, ts: Date.now() });
    res.json(results);
  } catch (err) {
    console.error("[city-router] Nominatim fetch error:", err);
    res.status(502).json({ error: "Impossibile raggiungere il servizio di geocoding" });
  }
});
