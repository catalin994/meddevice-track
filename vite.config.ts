import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: mode === 'production' ? '/meddevice-track/' : '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
        warmup: {
          clientFiles: [
            './App.tsx',
            './components/DeviceList.tsx',
            './components/Dashboard.tsx',
            './components/DeviceDetail.tsx',
          ],
        },
      },
      plugins: [
        react(),
        tailwindcss(),
        VitePWA({
          // 'prompt', not 'autoUpdate': a silent reload could interrupt a scan
          // half-way through. The banner lets the user pick the moment.
          registerType: 'prompt',
          includeAssets: ['apple-touch-icon.png', 'favicon-64.png'],
          manifest: {
            name: 'Biomedic — Registru echipamente medicale',
            short_name: 'Biomedic',
            description: 'Inventar, mentenanta si documente pentru aparatura medicala.',
            lang: 'ro',
            start_url: '/meddevice-track/',
            scope: '/meddevice-track/',
            display: 'standalone',
            orientation: 'portrait',
            background_color: '#0b1120',
            theme_color: '#f8fafc',
            icons: [
              { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
              { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
              { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
          },
          workbox: {
            // Everything the app needs to boot, and nothing else. The first
            // visit never passes through the service worker, so a chunk the
            // entry imports statically has to be precached — it will not be in
            // the runtime cache when the phone reloads with no signal.
            // The heavy optional chunks stay out: precaching them would turn
            // installing the app into a ~4MB download.
            // .docx: sabloanele institutiei. Sunt ~240K impreuna, dar fara ele
            // un referat facut in sectie, fara semnal, ar iesi pe formatul
            // aplicatiei in loc de hartia spitalului — adica altfel decat cel
            // facut in birou, si nimeni n-ar intelege de ce.
            globPatterns: ['**/*.{css,html,ico,png,svg,woff2,js,docx}'],
            maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
            globIgnores: [
              '**/vendor-exceljs-*.js',   // 920K — export Excel
              '**/vendor-xlsx-*.js',      // 420K — import Excel
              '**/vendor-recharts-*.js',  // 376K — graficele din Panou
              '**/vendor-ai-*.js',        // 284K — extragere date din PDF
              '**/pdf-*.js',              // 464K — randare PDF
              '**/jsQR-*.js',             // 128K — scanare cod QR
              // OCR: firul de lucru, motoarele si datele de limba, vreo 11MB.
              // Se aduc doar cand cineva citeste un document scanat, si raman
              // apoi in cache-ul browserului. Precacheate, ar fi transformat
              // instalarea aplicatiei intr-o descarcare de treisprezece MB.
              'ocr/**',
            ],
            navigateFallback: '/meddevice-track/index.html',
            navigateFallbackDenylist: [/^\/meddevice-track\/404\.html$/],
            cleanupOutdatedCaches: true,
            runtimeCaching: [
              {
                // every other build chunk, on first use
                urlPattern: ({ url }) => url.pathname.startsWith('/meddevice-track/assets/'),
                handler: 'CacheFirst',
                options: {
                  cacheName: 'meditrack-chunks',
                  expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 60 },
                },
              },
              {
                urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
                handler: 'CacheFirst',
                options: {
                  cacheName: 'meditrack-fonts',
                  expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
            ],
          },
          devOptions: { enabled: false },
        }),
      ],
      optimizeDeps: {
        include: ['exceljs'],
      },
      build: {
        modulePreload: {
          resolveDependencies: (_url, deps) => deps.filter(d => !d.includes('exceljs') && !d.includes('recharts')),
        },
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom'],
              'vendor-recharts': ['recharts'],
              'vendor-xlsx': ['xlsx'],
              'vendor-icons': ['lucide-react'],
              'vendor-db': ['@supabase/supabase-js'],
              'vendor-ai': ['@google/genai'],
              'vendor-exceljs': ['exceljs'],
            }
          }
        },
        chunkSizeWarningLimit: 1000,
      },
      define: {
        // Lets the UI show which build is actually running — invaluable when a
        // phone silently serves a cached bundle.
        '__BUILD_ID__': JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
