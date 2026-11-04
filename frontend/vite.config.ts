import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // "@/something" means "src/something", so imports never need long "../../../" paths.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // If 5173 is busy, stop with an error instead of silently moving to another port:
    // the backend only allows requests from http://localhost:5173 (CORS).
    strictPort: true,
  },
  test: {
    environment: 'jsdom', // a pretend browser, so components can be tested without opening one
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
  },
})
