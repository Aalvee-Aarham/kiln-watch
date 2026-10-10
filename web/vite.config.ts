/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// DATA_SRC=fixtures serves web/fixtures/<FIXTURE_BRANCH>/; DATA_SRC=real serves web/public/. Nothing is copied.
// Default branch is nokiln: the real run's gate branch, whose fixture set is a verbatim offline copy of the real export.
const src = process.env.DATA_SRC ?? 'fixtures'
const branch = process.env.FIXTURE_BRANCH ?? 'nokiln'

export default defineConfig({
  base: process.env.BASE_PATH ?? '/kiln-watch/',
  publicDir: src === 'real' ? 'public' : `fixtures/${branch}`,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Kiln Watch',
        short_name: 'KilnWatch',
        description: 'Bangladesh burning calendar and kiln tracker from NASA satellite data.',
        theme_color: '#fdfbfa',
        background_color: '#fdfbfa',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,geojson,jpg,jpg,woff2,wasm}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
      }
    })
  ],
  build: { chunkSizeWarningLimit: 900 },
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'] },
})
