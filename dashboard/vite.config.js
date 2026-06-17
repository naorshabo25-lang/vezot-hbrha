import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'זאת הברכה דלקים — ניהול',
        short_name: 'זאת הברכה',
        description: 'מערכת ניהול פיננסי — זאת הברכה דלקים ושמנים',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#d32f2f',
        orientation: 'any',
        lang: 'he',
        dir: 'rtl',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/dashboard/, /^\/api\//, /^\/static\//, /^\/webhook/, /^\/submit-order/, /^\/order-form\//],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', networkTimeoutSeconds: 10 },
          },
          {
            urlPattern: /^https?:\/\/.*\/dashboard/,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})
