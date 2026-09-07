import { defineConfig } from 'vite';
export default defineConfig({
  base: process.env.BASE_PATH || './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 4500, rolldownOptions: { input: { main: 'index.html', scene: 'scene.html' } } },
  server: { host: '127.0.0.1' },
});
