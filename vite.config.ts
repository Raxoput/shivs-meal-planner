import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// IMPORTANT: Replace '<YOUR_REPOSITORY_NAME>' with the actual name of your GitHub repository.
// For example, if your repository URL is https://github.com/your-username/my-meal-planner,
// then GITHUB_REPOSITORY_NAME should be 'my-meal-planner'.
const GITHUB_REPOSITORY_NAME = 'shivs-meal-planner';

export default defineConfig(({ command }) => {
  const base = command === 'build' && GITHUB_REPOSITORY_NAME !== 'shivs-meal-planner'
                 ? `/${shivs-meal-planner}/`
                 : '/';
  return {
    plugins: [react()],
    base: base,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    build: {
      outDir: 'dist'
    },
    server: {
      port: 3000 // Optional: specify a port for the dev server
    }
  }
})
