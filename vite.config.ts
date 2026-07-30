import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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
      plugins: [react(), tailwindcss()],
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
