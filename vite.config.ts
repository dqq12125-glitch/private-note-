/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// `vite build --mode artifact`：打包成一个文件，托管到 claude.ai（见 scripts/inline-artifact.mjs）
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), tailwindcss()],
  build:
    mode === 'artifact'
      ? {
          outDir: 'dist-artifact',
          cssCodeSplit: false,
          assetsInlineLimit: 100_000_000,
          rollupOptions: { output: { inlineDynamicImports: true } },
        }
      : undefined,
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}))
