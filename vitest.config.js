import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const videoRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  root: videoRoot,
  test: {
    environment: 'happy-dom',
    include: [
      'src/**/*.{test,spec}.{js,jsx}',
      'shared/asset-access/**/*.test.js'
    ],
    server: {
      deps: {
        inline: [/@mui\/.*/, '@emotion/react', '@emotion/styled', 'react-transition-group']
      }
    }
  }
})
