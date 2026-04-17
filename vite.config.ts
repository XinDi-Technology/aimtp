import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'fix-crossorigin',
      generateBundle(_options: any, bundle: any) {
        const htmlFile = bundle['index.html'];
        if (htmlFile && htmlFile.type === 'asset') {
          htmlFile.source = (htmlFile.source as string).replace(
            /crossorigin=""/g,
            'crossorigin="anonymous"'
          );
        }
      },
    },
  ],
  root: resolve(__dirname, 'src/renderer'),
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    target: 'es2020',
    minify: 'esbuild',
    chunkSizeWarningLimit: 2000,
    cssMinify: false,
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
  // preview 使用项目根目录作为根目录，但需要手动切换到 dist/renderer
  preview: {
    port: 4173,
  },
});