import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '::',
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@monaco-editor') || id.includes('node_modules/monaco-editor')) {
            return 'monaco-vendor';
          }
          if (id.includes('node_modules/recharts')) {
            return 'recharts-vendor';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'lucide-vendor';
          }
        }
      }
    }
  }
})
