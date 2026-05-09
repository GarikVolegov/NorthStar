/**
 * pwa.config.ts — Configurazione VitePWA per NorthStar
 *
 * IMPORT in vite.config.ts:
 *   import { pwaPlugin } from "./pwa.config";
 *   // poi aggiungere pwaPlugin nel array plugins[]
 *
 * INSTALL (una-tantum):
 *   pnpm add vite-plugin-pwa -D
 *
 * ICONE richieste (creare in apps/web/public/icons/):
 *   icon-192.png   (192x192)
 *   icon-512.png   (512x512)
 *   favicon.ico
 *
 * CACHING STRATEGY:
 *   - Asset statici (JS/CSS/font/img): precache via Workbox globPatterns
 *   - /api/growth-agent/onboarding/status: CacheFirst (risposta stabile)
 *   - Tutte le altre /api/*: NetworkFirst con fallback cache 24h
 *     e timeout rete 5s (utile su connessioni lente o flaky)
 *
 * PRPL PATTERN:
 *   - Push:       asset critici precachati al primo service worker install
 *   - Render:     start_url="/" serve immediatamente dalla cache
 *   - Pre-cache:  globPatterns copre JS/CSS/HTML di tutte le rotte
 *   - Lazy-load:  il resto del codice viene caricato on-demand da React.lazy
 */
import { VitePWA } from "vite-plugin-pwa";

export const pwaPlugin = VitePWA({
  registerType: "autoUpdate",

  // File statici aggiuntivi da includere nel precache
  includeAssets: ["favicon.ico", "robots.txt", "icons/*.png"],

  manifest: {
    name:             "NorthStar — Il tuo percorso di crescita",
    short_name:       "NorthStar",
    description:      "La piattaforma AI di orientamento personale e professionale",
    theme_color:      "#4f46e5",       // indigo-600 (coerente col brand)
    background_color: "#000000",
    display:          "standalone",
    start_url:        "/",
    icons: [
      {
        src:   "/icons/icon-192.png",
        sizes: "192x192",
        type:  "image/png",
      },
      {
        src:   "/icons/icon-512.png",
        sizes: "512x512",
        type:  "image/png",
      },
      {
        src:     "/icons/icon-512.png",
        sizes:   "512x512",
        type:    "image/png",
        purpose: "maskable",  // icona adattiva per Android launcher
      },
    ],
  },

  workbox: {
    // Precache di tutti gli asset statici generati da Vite
    globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],

    runtimeCaching: [
      {
        // Onboarding status: risposta stabile → CacheFirst (veloce, no network)
        urlPattern: /^\/api\/growth-agent\/onboarding\/status$/i,
        handler:    "CacheFirst",
        options: {
          cacheName:  "onboarding-status-cache",
          expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 }, // 1h
        },
      },
      {
        // Tutte le altre API: NetworkFirst con fallback cache 24h
        // networkTimeoutSeconds: 5 → dopo 5s usa la cache (reti lente/offline)
        urlPattern: /^\/api\/.*/i,
        handler:    "NetworkFirst",
        options: {
          cacheName:             "api-cache",
          networkTimeoutSeconds: 5,
          expiration: {
            maxEntries:    50,
            maxAgeSeconds: 60 * 60 * 24, // 24h
          },
        },
      },
    ],
  },
});
