import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.API_INTERNAL_URL ?? 'http://localhost:5080'
  const apiProxy = {
    target: apiTarget,
    changeOrigin: true,
    secure: false,
  }

  return {
    plugins: [
      tanstackStart(),
      nitro({
        devProxy: {
          '/api/**': apiProxy,
          '/health': apiProxy,
        },
      }),
      tailwindcss(),
      react(),
    ],
    resolve: {
      alias: {
        '~': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 3000,
    },
  }
})
