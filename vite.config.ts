import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { isPocketBaseRequest, navigationAllowlist, normalizeBase } from './src/basePath.ts'

export default defineConfig(({ command }) => {
  const base = normalizeBase(process.env.BASE_PATH, command === 'build' ? '/nightyard/' : '/')
  return {
    base,
    plugins: process.env.VITEST
      ? []
      : [
          {
            name: 'ny-build-id',
            transformIndexHtml(html: string) {
              return html.replaceAll('__NY_BUILD_ID__', process.env.VITE_BUILD_ID ?? '')
            },
          },
          preact(),
          VitePWA({
            registerType: 'prompt',
            includeAssets: ['favicon-16.png', 'favicon-32.png', 'icons/*.png'],
            manifest: {
              id: base,
              name: 'Night Yard',
              short_name: 'Night Yard',
              description: 'Phone-first football play designer',
              theme_color: '#F9682D',
              background_color: '#191919',
              display: 'standalone',
              orientation: 'portrait',
              lang: 'en',
              start_url: base,
              scope: base,
              icons: [
                { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
                { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,jpg,webp,woff2,webmanifest,ico}'],
              navigateFallback: 'index.html',
              navigateFallbackAllowlist: [navigationAllowlist(base)],
              navigateFallbackDenylist: [/\/nightyard\/pb(?:\/|$)/],
              runtimeCaching: (['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const).map((method) => ({
                urlPattern: ({ url }: { url: URL }) => isPocketBaseRequest(url.pathname),
                handler: 'NetworkOnly' as const,
                method,
              })),
              cleanupOutdatedCaches: true,
              cacheId: 'night-yard-4',
              // The new worker waits until the page asks it to take over, then claims open tabs.
              skipWaiting: false,
              clientsClaim: true,
            },
          }),
        ],
    server: {
      host: '127.0.0.1',
      port: 43123,
      strictPort: true,
      proxy: {
        '/nightyard/pb': {
          target: 'http://127.0.0.1:8090',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/nightyard\/pb/, '') || '/',
        },
      },
    },
    preview: { host: '127.0.0.1', port: 43123, strictPort: true },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
