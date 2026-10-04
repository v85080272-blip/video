import { defineConfig } from 'vite';

// two pages: Залип Лаб (index.html) and Тренд Студия (studio.html)
export default defineConfig({
  build: { rollupOptions: { input: { main: 'index.html', studio: 'studio.html' } } },
});
