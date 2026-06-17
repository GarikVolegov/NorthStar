import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { resolveWebPort } from "./src/lib/dev-port";

const port = resolveWebPort(process.env);

const basePath = process.env.BASE_PATH || "/";
const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA;
const releaseEnvironment =
  process.env.VERCEL_ENV === "production"
    ? "production"
    : process.env.VERCEL_ENV === "preview"
      ? "staging"
      : process.env.SENTRY_ENVIRONMENT;
const sentryRelease =
  process.env.SENTRY_RELEASE ??
  process.env.VITE_SENTRY_RELEASE ??
  (commitSha && releaseEnvironment
    ? `${releaseEnvironment}@${commitSha.slice(0, 7)}`
    : commitSha);
const shouldUploadSourcemaps = Boolean(
  process.env.SENTRY_AUTH_TOKEN &&
    process.env.SENTRY_ORG &&
    process.env.SENTRY_PROJECT &&
    sentryRelease,
);

export default defineConfig(async ({ command }) => ({
  base: basePath,
  define: {
    __GOOGLE_CLIENT_ID__: JSON.stringify(process.env.GOOGLE_CLIENT_ID ?? ""),
    "import.meta.env.VITE_SENTRY_RELEASE": JSON.stringify(sentryRelease ?? ""),
    "import.meta.env.VITE_COMMIT_SHA": JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "",
    ),
  },
  plugins: [
    react(),
    tailwindcss(),
    // basicSsl serves the dev server over HTTPS for local PWA/service-worker
    // testing. In CI the e2e health check and Playwright use http://, so a
    // self-signed HTTPS server would make every request fail ("empty reply").
    command === "serve" && !process.env.CI && basicSsl(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "hero.png", "robots.txt"],
      manifest: {
        name: "NorthStar — Orientamento e Crescita Personale",
        short_name: "NorthStar",
        description:
          "Scopri la tua via. Test RIASEC + Cinque Spiriti, matching con settori professionali e strumenti per la tua carriera.",
        theme_color: "#0d1520",
        background_color: "#0d1520",
        display: "standalone",
        lang: "it",
        start_url: "/",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        // Aumentato staleWhileRevalidate a 7 giorni per asset statici
        runtimeCaching: [
          {
            urlPattern: /\/api\/(sectors|stats)/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "api-cache",
              expiration: { maxAgeSeconds: 3600, maxEntries: 50 },
            },
          },
          {
            urlPattern: /\/api\/(user|notifications)/,
            handler: "NetworkFirst",
            options: {
              cacheName: "user-cache",
              networkTimeoutSeconds: 4,
              expiration: { maxAgeSeconds: 300, maxEntries: 20 },
            },
          },
          {
            urlPattern: /\.(?:woff2|woff|ttf|eot)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "font-cache",
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
    shouldUploadSourcemaps &&
      (await import("@sentry/vite-plugin")).sentryVitePlugin({
        org: process.env.SENTRY_ORG!,
        project: process.env.SENTRY_PROJECT!,
        authToken: process.env.SENTRY_AUTH_TOKEN!,
        release: { name: sentryRelease! },
        sourcemaps: {
          assets: "./dist/public/assets/**",
          filesToDeleteAfterUpload: ["./dist/public/assets/**/*.map"],
        },
      }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "docs",
        "attached_assets",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Target ES2020: usa native async/await, evita transpilazione pesante
    target: "es2020",
    // Split CSS per chunk: carica solo il CSS della pagina attiva
    cssCodeSplit: true,
    // Warn solo sopra 800kb
    chunkSizeWarningLimit: 800,
    // Minifica con esbuild (molto più veloce di terser, output quasi identico)
    minify: "esbuild",
    sourcemap: shouldUploadSourcemaps ? "hidden" : false,
    rollupOptions: {
      output: {
        // Hash brevi per URL più corti
        hashCharacters: "base36",
        manualChunks: (id) => {
          // React core
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/wouter/")
          ) {
            return "vendor-react";
          }
          // Animazioni — chunk separato: non serve su tutte le pagine
          if (id.includes("node_modules/framer-motion/")) {
            return "vendor-motion";
          }
          // Charts — pesante, lazy separato
          if (
            id.includes("node_modules/recharts/") ||
            id.includes("node_modules/d3")
          ) {
            return "vendor-charts";
          }
          // Radix UI
          if (id.includes("node_modules/@radix-ui/")) {
            return "vendor-radix";
          }
          // Tanstack Query
          if (id.includes("node_modules/@tanstack/")) {
            return "vendor-query";
          }
          // Forms
          if (
            id.includes("node_modules/react-hook-form/") ||
            id.includes("node_modules/@hookform/") ||
            id.includes("node_modules/zod/")
          ) {
            return "vendor-forms";
          }
          // Icone
          if (id.includes("node_modules/lucide-react/")) {
            return "vendor-ui";
          }
          // i18n
          if (
            id.includes("node_modules/i18next") ||
            id.includes("node_modules/react-i18next")
          ) {
            return "vendor-i18n";
          }
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        // Segue la porta del server (PORT, default 3201) così il proxy resta
        // allineato se cambi la porta dell'API.
        target: `http://localhost:${process.env.PORT || "3201"}`,
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
    },
    // In dev non bloccare la cache degli asset statici (solo HTML)
    headers: {
      "Cache-Control": "no-cache",
    },
    // Warm-up delle pagine più visitate al primo avvio del dev server
    warmup: {
      clientFiles: [
        "./src/pages/home.tsx",
        "./src/pages/test.tsx",
        "./src/pages/results.tsx",
        "./src/components/layout/Navbar.tsx",
      ],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  // Ottimizza dipendenze pre-bundle in dev
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "wouter",
      "@tanstack/react-query",
      "framer-motion",
      "lucide-react",
      "recharts",
    ],
  },
}));
