import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// واجهتان منفصلتان تماماً: play.html (اللاعبون) و admin.html (الإدارة)
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
    rollupOptions: { input: { play: resolve(__dirname, 'play.html'), admin: resolve(__dirname, 'admin.html') } },
  },
  server: { proxy: { '/api': 'http://localhost:8080', '/uploads': 'http://localhost:8080', '/ws': { target: 'ws://localhost:8080', ws: true } } },
});
