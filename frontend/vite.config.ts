import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En desarrollo, las peticiones /api se envían al backend local
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } },
  },
});
