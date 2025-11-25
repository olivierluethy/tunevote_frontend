import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      // Dateien, die zusätzlich übernommen werden sollen
      includeAssets: [
        'icons/icon-192.png',
        'icons/icon-512.png'
      ],

      manifest: {
        name: 'TuneVote',
        short_name: 'TuneVote',
        description: 'Vote on songs with your friends!',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1db954',

        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})
