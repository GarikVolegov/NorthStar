import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Carica variabili VITE_* da .env, .env.local, .env.[mode]
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],

    resolve: {
      alias: {
        // @/ punta a apps/web/src
        // Allineato con tsconfig.json paths per evitare discrepanze
        '@': path.resolve(__dirname, './src'),
      },
    },

    server: {
      port: 5173,
      host: true,
      // Proxy API verso northstar-server in dev locale
      proxy: {
        '/api': {
          target: env.VITE_API_URL ?? 'http://localhost:3001',
          changeOrigin: true,
          // Non riscrive il path: /api/health → http://localhost:3001/api/health
        },
      },
    },

    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      // Chunk splitting: vendor React separato per cache-busting efficiente
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            motion: ['framer-motion'],
          },
        },
      },
    },
  };
});
