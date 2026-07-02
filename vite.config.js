import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Docent',
        short_name: 'Docent',
        start_url: '/',
        display: 'standalone',
        background_color: '#FAFAF9',
        theme_color: '#FAFAF9',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/www\.artic\.edu\/iiif\//,
            handler: 'CacheFirst',
            options: { cacheName: 'aic-images', expiration: { maxEntries: 200, maxAgeSeconds: 86400 * 30 } },
          },
          {
            urlPattern: /^https:\/\/api\.artic\.edu\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'aic-api' },
          },
        ],
      },
    }),
  ],
})
