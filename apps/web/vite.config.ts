/**
 * vite.config.ts — apps/web
 *
 * Phase 2 upgrades:
 *   ✔ vite-plugin-pwa  — manifest + Workbox service worker
 *   ✔ rollup-plugin-visualizer — bundle analysis (pnpm analyze)
 *   ✔ Advanced manualChunks — Recharts, Radix, framer-motion separati
 *   ✔ build.target ES2020 con minify esbuild
 *   ✔ Sourcemap solo in dev/staging
 */

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isAnalyze = process.env.ANALYZE === 'true';

  // Lazy import visualizer solo quando serve (non in production build normale)
  const extraPlugins: import('vite').Plugin[] = [];
  if (isAnalyze) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { visualizer } = require('rollup-plugin-visualizer');
    extraPlugins.push(
      visualizer({
        open: true,
        gzipSize: true,
        brotliSize: true,
        filename: 'dist/bundle-report.html',
      })
    );
  }

  return {
    plugins: [
      react(),
      tailwindcss(),

      // ─── Phase 2: PWA ─────────────────────────────────────────────
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.ico', 'icons/*.png', 'icons/*.svg'],

        manifest: {
          name: 'NorthStar — Orientamento Professionale',
          short_name: 'NorthStar',
          description: 'Scopri il tuo percorso professionale con AI. Test RIASEC, roadmap personalizzate e coaching.',
          start_url: '/',
          display: 'standalone',
          orientation: 'portrait-primary',
          background_color: '#0e1018',
          theme_color: '#0e1018',
          lang: 'it',
          icons: [
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          screenshots: [
            {
              src: '/screenshots/mobile-home.png',
              sizes: '390x844',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'Home NorthStar su mobile',
            },
          ],
          categories: ['education', 'productivity'],
          shortcuts: [
            {
              name: 'Vai al Test',
              short_name: 'Test',
              url: '/test',
              icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
            },
            {
              name: 'Dashboard',
              short_name: 'Dashboard',
              url: '/dashboard',
              icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
            },
          ],
        },

        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,webp,avif}'],
          runtimeCaching: [
            {
              urlPattern: /^\/api\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 5,
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
          ],
          skipWaiting: true,
          clientsClaim: true,
        },
      }),

      // ─── Bundle visualizer (solo con pnpm analyze) ───────────────────
      ...extraPlugins,
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        // @growth-agent → lib/growth-agent/src  (fix #13 — elimina ../../../lib/ relativi)
        '@growth-agent': path.resolve(__dirname, '../../lib/growth-agent/src'),
      },
    },

    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: env.VITE_API_URL ?? 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },

    build: {
      outDir: 'dist',
      target: 'ES2020',
      minify: 'esbuild',
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 500,

      rollupOptions: {
        output: {
          manualChunks: (id: string) => {
            if (id.includes('node_modules/react/') ||
                id.includes('node_modules/react-dom/') ||
                id.includes('node_modules/scheduler/')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/wouter/')) {
              return 'vendor-router';
            }
            if (id.includes('node_modules/framer-motion/')) {
              return 'vendor-motion';
            }
            if (id.includes('node_modules/recharts/') ||
                id.includes('node_modules/d3') ||
                id.includes('node_modules/victory')) {
              return 'vendor-charts';
            }
            if (id.includes('node_modules/@radix-ui/')) {
              return 'vendor-radix';
            }
            if (id.includes('node_modules/@tanstack/')) {
              return 'vendor-query';
            }
            if (id.includes('node_modules/lucide-react/')) {
              return 'vendor-icons';
            }
            if (id.includes('node_modules/zod/')) {
              return 'vendor-zod';
            }
            if (id.includes('node_modules/')) {
              return 'vendor-misc';
            }
          },
        },
      },
    },
  };
});
