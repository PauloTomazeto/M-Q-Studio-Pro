import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 5173,
      // HMR configuration for Hot Module Replacement
      // If dev server is on different port or domain, update these values
      hmr: process.env.DISABLE_HMR === 'true' ? false : {
        host: 'localhost',
        port: 5173,
        protocol: 'ws'
      },
      // CORS and headers configuration
      middlewareMode: false,
      headers: {
        'Cross-Origin-Resource-Policy': 'cross-origin',
        // DO NOT set COEP here - it blocks resource loading
      }
    },
  };
});
