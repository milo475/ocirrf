import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // /api гэсэн хүсэлтүүдийг NestJS backend (порт 3000) руу дамжуулна
      '/api': 'http://localhost:3000',
    },
  },
})
