# Changelog

## v0.2.16 - 2026-10-03

### 工程
- 删除旧版模板 UI 遗留死 CSS（约 220 行）：components.css 的 template-dropdown / -menu / -item、弹窗式 template-selection-overlay / -panel / -header / close-btn、卡片式 template-grid / template-card（-header / -actions）、.panel-header 系列及 fadeIn / slideUp keyframes；layout.css 的 toolbar-title / toolbar-divider / .toolbar .btn-text / margin-inputs / .preview-panel.preview-full-width（保留在用类：template-selection-inline(-panel) / -content / template-section / template-card-icon / -desc / template-select-btn / -delete-btn）
- 移除 PreviewPanel 被忽略的 className prop：组件从不解构 props，App.tsx 传入的 preview-full-width 从未生效（选择器前缀 .preview-panel 无对应 DOM，根元素样式由 containerStyle 内联覆盖），同步删除调用参数与 PreviewPanelProps 类型声明

## v0.2.15 - 2026-10-03

### 工程
- 删除零引用类型声明文件 `src/renderer/types/woff2.d.ts`（`*.woff2?base64` 全库无 TS 导入，字体统一由 CSS `url()` 引用）
- 清理 `src/renderer/types/css.d.ts` 中 6 处死声明：`*.css` / `*.svg` / `*.woff` / `*.woff2` / `*.ttf` 五条资源通配声明（同等功能已由 vite/client 提供，全库资源类导入仅两处 `?raw`、一处 CSS 副作用导入），以及与 `pagedjs.d.ts` 重复的 `declare module 'pagedjs'` 副本（`import type { Flow }` 的类型来源统一为 `pagedjs.d.ts`）

## v0.2.14 - 2026-10-02

### 工程
- 删除 HandlerRegistry（全库无 register() 调用，getAllHandlerClasses() 恒返回空数组）及 PagedJsAdapter 中配套的 Handler 注册链路（registerHandler / clearHandlers / registeredHandlerConstructors 与 layout() 内的注册块）：运行时从未注册过任何 Paged.js Handler，分页与预览行为零变化
- AimtpHandler.ts 缩减为纯类型文件：移除无子类的抽象基类与 Handler 上下文，仅保留页眉页脚配置类型（HeaderFooterConfig / FrontMatter）

## v0.2.13 - 2026-10-02

### 工程
- 删除 useAppStore 中零引用的自动保存子系统（约 68 行死代码）：应用无编辑器场景、全库无 UI 调用入口，且与 zustand persist 形成双重持久化冗余；用户遗留的 localStorage 数据启动时被自动忽略，无迁移影响

## v0.2.12 - 2026-10-02

### 修复
- 修复中文长段落跨页时预览渲染崩溃（TypeError: Cannot read properties of undefined (reading 'ref')）：pagedjs 0.5.0-beta.2 发布的 dist 产物仍含旧版 indexOfTextNode，未防护溢出拆分文本节点的 previousSibling 为文本节点的场景；新增 IIFE 注入补丁 1.8 将非元素兄弟路由至按字计数路径

## v0.2.11 - 2026-10-02

### 工程
- 删除零引用死文件：HeaderFooterHandler、HeaderFooterMaterializer、CssArchitecture、PreviewPanel.css、exportHtmlGenerator 及 debug-layout.html（页眉页脚功能由 PagedJsAdapter 内联实现承担，不受影响）
- 移除 usePDFExport 中永不执行的旧版导出分支（含对已删 exportHtmlGenerator 的动态 import），导出统一走 ExportOrchestrator 管线
- 更新三处指向已删模块的过时注释

## v0.2.9 - 2026-10-01

### 工程
- markdown-it v15 升级收尾：移除过时的 @types/markdown-it 与 @types/markdown-it-footnote（连带 @types/linkify-it），footnote 类型改为本地声明并锚定 v15 内建类型

## v0.2.8 - 2026-10-01

### 工程
- CI 提速：移除 build-electron 与 test job 中的重复构建，每次 push 少 2 次全量 vite build
- 测试服务器由 npx serve 改为 npx vite preview，消除运行时隐式拉取未锁定依赖的供应链风险
- 移除本地向脚本（dev/dev:vite/dev:electron/preview/test:preview）与未用依赖 concurrently/wait-on

## v0.2.7 - 2026-10-01

### 优化
- 安装包深度瘦身：仅渲染进程使用的 16 个依赖（react/mermaid/mathjax/highlight.js 等）移至 devDependencies，不再重复打进安装包

## v0.2.6 - 2026-10-01

### 优化
- 安装包瘦身：移除 asar 内冗余字体副本（约 13.5MB），预览与 PDF 导出的字体加载路径不受影响

### 工程
- GitHub Release 页面开始展示版本变更说明（CHANGELOG.md 自动抽取）
