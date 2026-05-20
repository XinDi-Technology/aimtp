import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  define: {
    __FONTS_DIR__: JSON.stringify(resolve(__dirname, 'src/fonts')),
  },
  plugins: [
    react(),
    {
      name: 'fix-crossorigin',
      generateBundle(_options: any, bundle: any) {
        const htmlFile = bundle['index.html'];
        if (htmlFile && htmlFile.type === 'asset') {
          // 更加健壮的替换逻辑，匹配 crossorigin, crossorigin="", crossorigin='anonymous' 等
          htmlFile.source = (htmlFile.source as string).replace(
            /crossorigin(="[^"]*"|='[^']*'|(?!\s*>))?/g,
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
    minify: 'oxc',
    chunkSizeWarningLimit: 600,
    cssMinify: true,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          // React 生态
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'vendor-react';
          // Markdown 处理（独立 chunk，降低单 chunk 体积）
          if (id.includes('node_modules/markdown-it/')) return 'vendor-markdown';
          // 代码高亮（highlight.js 约 800kB+，独立 chunk）
          if (id.includes('node_modules/highlight.js/')) return 'vendor-highlightjs';
          // 基础工具库（体积小，合并 chunk）
          if (id.includes('node_modules/dompurify/') || id.includes('node_modules/zustand/')) return 'vendor-utils';
          // MathJax（数学公式渲染，内部使用 new Function()/eval，存在 CSP 安全风险）
          // 已知风险：mathjax 使用 new Function() 动态编译 TeX 表达式，在严格 CSP 环境下需要 unsafe-eval
          // 缓解措施：用户输入经 DOMPurify 净化，Electron 环境通过 CSP 白名单控制
          if (id.includes('node_modules/mathjax/')) return 'vendor-mathjax';
          // Mermaid（图表渲染，体积约 1000kB）
          if (id.includes('node_modules/mermaid/')) return 'vendor-mermaid';
          // Paged.js（分页排版引擎）
          if (id.includes('node_modules/pagedjs/')) return 'vendor-pagedjs';
        },
        // 启用 gzip 压缩
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && (assetInfo.name.endsWith('.woff2') || assetInfo.name.endsWith('.ttf'))) {
            return 'assets/fonts/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    // 启用 sourcemap 排除（生产环境不需要）
    sourcemap: false,
  },
  resolve: {
    conditions: ['browser', 'import', 'module', 'default'],
  },
  assetsInclude: ['**/*.ttf', '**/*.woff', '**/*.woff2'],
  // preview 使用项目根目录作为根目录，但需要手动切换到 dist/renderer
  preview: {
    port: 4173,
  },
});