# Changelog

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
