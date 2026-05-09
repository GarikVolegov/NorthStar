/**
 * pwa.config.ts — Configurazione VitePWA per NorthStar (mockup-sandbox)
 *
 * Copia locale di apps/web/pwa.config.ts per evitare import cross-package
 * che rompono Vite con fs.strict: true.
 *
 * CACHING STRATEGY:
 *   - Asset statici: precache via Workbox globPatterns
 *   - /api/growth-agent/onboarding/status: CacheFirst (risposta stabile, 1h)
 *   - Tutte le altre /api/*: NetworkFirst, timeout 5s, fallback cache 24h
 */
import { VitePWA } from "vite-plugin-pwa";

export const pwaPlugin = VitePWA({
  registerType: "autoUpdate",
  includeAssets: ["favicon.ico", "robots.txt", "icons/*.png"],

  manifest: {
    name:             "NorthStar — Il tuo percorso di crescita",
    short_name:       "NorthStar",
    description:      "La piattaforma AI di orientamento personale e professionale",
    theme_color:      "#4f46e5",
    background_color: "#000000",
    display:          "standalone",
    start_url:        "/",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  },

  workbox: {
    globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
    runtimeCaching: [
      {
        urlPattern: /^\/api\/growth-agent\/onboarding\/status$/i,
        handler:    "CacheFirst",
        options: {
          cacheName:  "onboarding-status-cache",
          expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 },
        },
      },
      {
        urlPattern: /^\/api\/.*/i,
        handler:    "NetworkFirst",
        options: {
          cacheName:             "api-cache",
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
        },
      },
    ],
  },
});
