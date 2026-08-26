/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined

  // Recharts and its d3 transitive deps
  if (
    id.includes('node_modules/recharts') ||
    id.includes('node_modules/d3-') ||
    id.includes('node_modules/victory-vendor') ||
    id.includes('node_modules/internmap') ||
    id.includes('node_modules/delaunator') ||
    id.includes('node_modules/robust-predicates')
  ) {
    return 'recharts'
  }

  if (
    id.includes('node_modules/react-dom') ||
    id.includes('node_modules/react-router') ||
    id.includes('node_modules/react-router-dom') ||
    id.includes('node_modules/scheduler') ||
    // Match react core only (not react-*, which would catch recharts etc.)
    /node_modules\/react\//.test(id) ||
    /node_modules\/react\.js$/.test(id)
  ) {
    return 'react-vendor'
  }

  if (
    id.includes('node_modules/react-hook-form') ||
    id.includes('node_modules/@hookform') ||
    id.includes('node_modules/zod') ||
    id.includes('node_modules/date-fns') ||
    id.includes('node_modules/date-fns-tz')
  ) {
    return 'form-vendor'
  }

  return undefined
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: true,
  },
})
