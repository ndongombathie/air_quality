/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const OSM_TILES = 'https://tile.openstreetmap.org';

/** Origine de l'API pour la CSP (mode rest) ; vide si l'URL est relative ou absente. */
function apiOrigin(baseUrl: string | undefined): string {
  if (!baseUrl) return '';
  try {
    return new URL(baseUrl).origin;
  } catch {
    return '';
  }
}

function securityHeaders(api: string): Record<string, string> {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    // Leaflet positionne ses éléments via l'attribut style : 'unsafe-inline' requis pour les styles uniquement.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    // blob: : aperçus locaux et médias du mode démonstration ; https: : médias servis par l'API.
    `img-src 'self' data: blob: ${OSM_TILES} https:`,
    "media-src 'self' blob: https:",
    ['connect-src', "'self'", api, OSM_TILES].filter(Boolean).join(' '),
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(self), camera=(), microphone=(), payment=()',
    'X-Frame-Options': 'DENY',
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png'],
        manifest: {
          name: "SEN-AIR : qualité de l'air à Thiès",
          short_name: 'SEN-AIR',
          description: "Surveillance de la qualité de l'air à Thiès : carte, indice IQA, prévisions et alertes.",
          lang: 'fr',
          dir: 'ltr',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'any',
          theme_color: '#5AC8FA',
          background_color: '#F3FBFF',
          categories: ['health', 'weather', 'utilities'],
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              // GET publics uniquement. /auth, /me et /admin ne correspondent jamais à ce motif.
              urlPattern: ({ url, request }) =>
                request.method === 'GET' &&
                /\/api\/v1\/(stations|air-quality|forecasts|alerts|articles|thresholds|health-guidance|zones|metadata)(\/|\?|$)/.test(
                  url.pathname,
                ),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'senair-api-public',
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 6 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              urlPattern: ({ url }) => url.origin === OSM_TILES,
              handler: 'CacheFirst',
              options: {
                cacheName: 'senair-osm-tiles',
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 14 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    server: { port: 5173 },
    preview: { port: 4173, headers: securityHeaders(apiOrigin(env.VITE_API_BASE_URL)) },
    build: {
      target: 'es2022',
      sourcemap: false,
      // Polices jamais inlinées en data: (CSP font-src 'self') ; servies et précachées comme fichiers.
      assetsInlineLimit: (file: string) => (file.endsWith('.woff2') ? false : undefined),
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}'],
    },
  };
});
