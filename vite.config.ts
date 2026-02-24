import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Redirige todas las peticiones /api a tu servidor Node.js (asumiendo que corre en el puerto 3000)
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
});