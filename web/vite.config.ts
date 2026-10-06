/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// DATA_SRC=fixtures serves web/fixtures/<FIXTURE_BRANCH>/; DATA_SRC=real serves web/public/. Nothing is copied.
const src = process.env.DATA_SRC ?? 'fixtures'
const branch = process.env.FIXTURE_BRANCH ?? 'full'

export default defineConfig({
  base: process.env.BASE_PATH ?? '/kiln-watch/',
  publicDir: src === 'real' ? 'public' : `fixtures/${branch}`,
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 900 },
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'] },
})
