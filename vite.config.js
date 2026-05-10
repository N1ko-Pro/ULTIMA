import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'

const alias = (relative) => fileURLToPath(new URL(relative, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@Frontend':     alias('./Frontend'),
      '@API':          alias('./Frontend/API'),
      '@Core':         alias('./Frontend/Core'),
      '@UI':           alias('./Frontend/UI'),
      '@Windows':      alias('./Frontend/Windows'),
      '@Shared':       alias('./Frontend/Shared'),
      '@Utils':        alias('./Frontend/Utils'),
      '@Config':       alias('./Frontend/Config'),
      '@Locales':      alias('./Frontend/Locales'),
      '@Assets':       alias('./Frontend/Assets'),
      '@Optimization': alias('./Frontend/Optimization'),
    },
  },
  server: {
    host: '127.0.0.1',
    hmr: {
      host: '127.0.0.1',
    },
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/react-virtuoso')) {
            return 'vendor-ui';
          }
        },
      },
    },
  },
  plugins: [
    react(),
    electron([
      {
        entry: 'Backend/main.js',
        vite: {
          build: {
            chunkSizeWarningLimit: 4096,
            rolldownOptions: {
              external: ['electron', 'node-unrar-js'],
            },
          },
        },
        onstart({ startup }) {
          startup();
        },
      },
      {
        entry: 'Backend/preload.js',
        onstart(options) {
          options.reload()
        },
      },
    ]),
  ],
})
