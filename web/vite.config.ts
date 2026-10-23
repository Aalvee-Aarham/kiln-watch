/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// DATA_SRC=fixtures serves web/fixtures/<FIXTURE_BRANCH>/; DATA_SRC=real serves web/public/. Nothing is copied.
// Default branch is nokiln: the real run's gate branch, whose fixture set is a verbatim offline copy of the real export.
const src = process.env.DATA_SRC ?? 'fixtures'
const branch = process.env.FIXTURE_BRANCH ?? 'nokiln'

// The app icon is emitted by the build, so it exists whichever publicDir serves the data.
const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#182233"/>${
  ['#eec469', '#ed9316', '#e05a00', '#b62b0d', '#79191b'].map((c, i) => `<rect x="${8 + i * 10}" y="${44 - i * 7}" width="7" height="${12 + i * 7}" rx="1.5" fill="${c}"/>`).join('')}</svg>`
const emitIcon: Plugin = { name: 'kw-icon', generateBundle() { this.emitFile({ type: 'asset', fileName: 'icon.svg', source: ICON }) } }

export default defineConfig({
  base: process.env.BASE_PATH ?? '/kiln-watch/',
  publicDir: src === 'real' ? 'public' : `fixtures/${branch}`,
  plugins: [
    react(),
    tailwindcss(),
    emitIcon,
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Kiln Watch',
        short_name: 'KilnWatch',
        description: 'Bangladesh burning calendar and kiln tracker from NASA satellite data.',
        theme_color: '#fdfbfa',
        background_color: '#fdfbfa',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
      },
      workbox: {
        // App shell only. Data (calendars, world maps: ~30 MB) is cached as each page is visited, network first so the
        // daily NRT update is never served stale while online.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['data/**'],
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.includes('/data/'),
          handler: 'NetworkFirst',
          options: { cacheName: 'kw-data', networkTimeoutSeconds: 5, expiration: { maxEntries: 300 } },
        }],
      }
    })
  ],
  build: { chunkSizeWarningLimit: 900 },
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'] },
})
