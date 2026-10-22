// [TIM] Konfigurasi build Vite.
// - plugin vue(): ngompilasi file .vue (Single File Component).
// - VitePWA(): bikin aplikasi bisa di-install & jalan offline (service worker).
//   PERHATIAN: nama & path ikon di manifest di bawah HARUS beneran ada di folder public/.
//   (pwa-192x192.png & pwa-512x512.png udah kita siapin.)
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      // [TIM] Aset statis yang ikut di-cache service worker - pastiin file-nya beneran ada di public/.
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Portal Kuis Interaktif',
        short_name: 'KuisApp',
        description: 'Aplikasi Kuis Interaktif dengan Supabase dan Vue',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})