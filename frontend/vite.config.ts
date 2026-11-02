import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// The dev server proxies /api to the backend so the browser sees one origin.
// That keeps the SameSite=Strict refresh cookie working and makes the Origin
// header equal to the backend FRONTEND_ORIGIN.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_DEV_PORT ?? 5173),
      proxy: { '/api': { target: env.VITE_BACKEND_URL ?? 'http://localhost:3000' } },
    },
  }
})
