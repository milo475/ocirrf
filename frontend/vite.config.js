import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA (V4-10): жолооч утсандаа суулгаж, offline үед ч app нээгдэнэ
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'ocirrf',
        short_name: 'ocirrf',
        description: 'Нөөц ба захиалгын систем',
        display: 'standalone',
        start_url: '/',
        background_color: '#141210',
        theme_color: '#141210',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell + asset-ууд precache хийгдэнэ; API кэшлэхгүй
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Жолоочийн жагсаалт: network-first, сүүлчийн амжилттай хариу кэш
            urlPattern: /\/api\/deliveries\/my$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'deliveries-my',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 4, maxAgeSeconds: 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        /**
         * App бүрийн lazy chunk-ийг танигдахуйц нэрлэнэ: манифестийн
         * loadRoutes нь src/apps/<key>/routes.jsx-ийг dynamic import
         * хийдэг тул тэр файлын chunk → assets/app-<key>-<hash>.js.
         * Build-ийн гаралтаас app бүрийн bundle хэмжээ шууд харагдана.
         */
        chunkFileNames: (chunk) => {
          const m = /\/src\/apps\/([^/]+)\/routes\.jsx$/.exec(
            chunk.facadeModuleId ?? '',
          )
          return m ? `assets/app-${m[1]}-[hash].js` : 'assets/[name]-[hash].js'
        },
      },
    },
  },
  server: {
    proxy: {
      // /api гэсэн хүсэлтүүдийг NestJS backend (порт 3000) руу дамжуулна
      '/api': 'http://localhost:3000',
    },
  },
})
