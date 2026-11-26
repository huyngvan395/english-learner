import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/scripts/**'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'lucide-react'],
          'data-listening': [
            './src/data/listeningPart1.ts',
            './src/data/listeningPart2.ts',
            './src/data/listeningPart3.ts',
            './src/data/listeningPart4.ts',
          ],
        },
      },
    },
  },
});
