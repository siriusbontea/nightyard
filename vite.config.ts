import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { navigationAllowlist, normalizeBase } from './src/basePath.ts'

export default defineConfig(({ command }) => {
  const base = normalizeBase(process.env.BASE_PATH, command === 'build' ? '/nightyard/' : '/')
  return {
    base,
    plugins: process.env.VITEST
      ? []
      : [
          preact(),
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'icons/*.png'],
            manifest: {
              id: base,
              name: 'Night Yard',
              short_name: 'Night Yard',
              description: 'Phone-first football play designer',
              theme_color: '#0b1220',
              background_color: '#0b1220',
              display: 'standalone',
              orientation: 'portrait',
              lang: 'en',
              start_url: base,
              scope: base,
              icons: [
                { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest,ico}'],
              navigateFallback: 'index.html',
              navigateFallbackAllowlist: [navigationAllowlist(base)],
              cleanupOutdatedCaches: true,
            },
          }),
        ],
    server: { host: '127.0.0.1', port: 43123, strictPort: true },
    preview: { host: '127.0.0.1', port: 43123, strictPort: true },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
