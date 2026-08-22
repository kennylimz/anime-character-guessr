import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const serverUrl = env.VITE_SERVER_URL || 'http://localhost:3000'
  
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: serverUrl,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('id_tags')) {
              return 'data-id-tags';
            }
            if (id.includes('node_modules')) {
              if (id.includes('react')) {
                return 'vendor-react';
              }
              if (id.includes('axios')) {
                return 'vendor-axios';
              }
              if (id.includes('socket.io')) {
                return 'vendor-socket';
              }
              return 'vendor-libs';
            }
          }
        }
      }
    }
  }
})
