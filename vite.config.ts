// vite.config.ts - CORRECTED VERSION

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// This constant holds the name of your repository. This is correct.
const GITHUB_REPOSITORY_NAME = 'shivs-meal-planner';

export default defineConfig(({ command }) => {
  // CORRECTED AND SIMPLIFIED LOGIC:
  // If the command is 'build' (for production), use the repository name as the base path.
  // Otherwise (for 'serve' or local dev), use the root path '/'.
  const base = command === 'build' 
    ? `/${GITHUB_REPOSITORY_NAME}/` 
    : '/';

  return {
    plugins: [react()],
    base: base, // Use the 'base' variable we just defined
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
  }
})