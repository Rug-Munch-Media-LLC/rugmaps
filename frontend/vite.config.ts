import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.js', '.ts', '.tsx', '.json'],
  },
  optimizeDeps: {
    include: ['framer-motion', 'react-router-dom', 'lucide-react', 'd3', 'cytoscape'],
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('d3')) return 'd3'
            if (id.includes('cytoscape')) return 'cytoscape'
            if (id.includes('framer-motion')) return 'framer'
            if (id.includes('lucide-react')) return 'icons'
            if (id.includes('react-dom') || id.includes('react/') || id.includes('react-router') || id.includes('scheduler')) return 'react'
            if (id.includes('@radix-ui')) return 'radix'
            return 'vendor'
          }
        },
        entryFileNames: 'assets/[name]-[hash:8].js',
        chunkFileNames: 'assets/[name]-[hash:8].js',
        assetFileNames: 'assets/[name]-[hash:8][extname]',
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true, secure: false },
    },
  },
})
