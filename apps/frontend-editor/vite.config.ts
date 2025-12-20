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
        '/api': {
          target: env.VITE_FE_URL,
          changeOrigin: false,
        },
      },
    },
  };
});
