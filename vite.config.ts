/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// `vite build --mode artifact`：打包成一个文件，托管到 claude.ai（见 scripts/inline-artifact.mjs）
// `vite build --mode standalone`：打包成一个能直接双击打开的离线 HTML（本地模式，数据存在浏览器里）
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), tailwindcss()],
  build:
    mode === 'artifact' || mode === 'standalone'
      ? {
          outDir: `dist-${mode}`,
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
