// vite.config.ts - FINAL CORRECTED VERSION

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // This is the crucial line. It tells Vite that in the final build,
  // all asset paths should be prefixed with '/shivs-meal-planner/'.
  base: '/shivs-meal-planner/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist'
  },
  server: {
    port: 3000
  }
})