# Changelog

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
