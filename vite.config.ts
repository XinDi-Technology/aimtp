import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, 'src/renderer'),
  // base: './', // 移除以使用绝对路径，避免相对路径解析问题
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    target: 'esnext',
    minify: 'esbuild',
    chunkSizeWarningLimit: 2000,
    cssMinify: false,
    // 禁用代码分割，使用单一 bundle，避免 Vite 8 + Rolldown 模块加载问题
    rollupOptions: {
      output: {
        codeSplitting: false,  // 强制单一文件输出
      },
    },
  },
  resolve: {
    conditions: ['browser', 'import', 'module', 'default'],
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@fonts': resolve(__dirname, 'src/fonts'),
    },
  },
  optimizeDeps: {
    exclude: ['mathjax'],
  },
  assetsInclude: ['**/*.ttf', '**/*.woff', '**/*.woff2'],
});