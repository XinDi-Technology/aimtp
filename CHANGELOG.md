# Changelog

## v0.2.7 - 2026-10-01

### 优化
- 安装包深度瘦身：仅渲染进程使用的 16 个依赖（react/mermaid/mathjax/highlight.js 等）移至 devDependencies，不再重复打进安装包

## v0.2.6 - 2026-10-01

### 优化
- 安装包瘦身：移除 asar 内冗余字体副本（约 13.5MB），预览与 PDF 导出的字体加载路径不受影响

### 工程
- GitHub Release 页面开始展示版本变更说明（CHANGELOG.md 自动抽取）
