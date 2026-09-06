import { defineConfig } from 'vite';
export default defineConfig({
  base: process.env.BASE_PATH || './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 800 },
  server: { host: '127.0.0.1' },
});
