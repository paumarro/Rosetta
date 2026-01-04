import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    // Base path for when app is served at /studio/ via nginx
    base: '/studio/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        {
          find: '@',
          replacement: fileURLToPath(new URL('./src', import.meta.url)),
        },
        {
          find: '@shared',
          replacement: fileURLToPath(new URL('../../shared', import.meta.url)),
        },
      ],
    },
    server: {
      host: '0.0.0.0', // Bind to all network interfaces (allows Docker to connect)
      port: 5173,
      proxy: {
        // Proxy /api/* requests to the main backend service (port 8080)
        // Note: Backend service must be running for /api/user/photo and other API endpoints
        // ECONNREFUSED errors are expected if the backend isn't running
        '/api': {
          target: env.VITE_FE_URL || 'http://localhost:8080',
          changeOrigin: false,
        },
        // WebSocket endpoint for collaborative editing
        // Rewrites /editor/ws -> / (root WebSocket endpoint)
        '/editor/ws': {
          target: env.VITE_EDITOR_API_URL || 'http://localhost:3001',
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/editor\/ws/, ''),
        },
        // All other /editor/* requests (diagrams, metrics, etc)
        // Rewrites /editor/metrics -> /api/metrics
        '/editor': {
          target: env.VITE_EDITOR_API_URL || 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/editor/, '/api'),
        },
      },
    },
  };
});
