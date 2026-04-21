# 代码审核报告

## 项目概述

Aimtp — Electron + React + TypeScript Markdown 转 PDF 桌面应用

## 审核范围

- src/main/main.ts
- src/main/preload.ts
- src/renderer/components/PreviewPanel.tsx
- src/renderer/components/SettingsPanel.tsx
- src/renderer/hooks/usePDFExport.ts
- src/renderer/utils/htmlGenerator.ts
- src/renderer/utils/markdown.ts
- src/shared/i18n.ts

---

## 发现的问题

### 高优先级

| # | 文件 | 行号 | 问题 | 严重性 | 状态 |
|---|------|------|------|--------|------|
| 1 | PreviewPanel.tsx | 176-195 | 内存泄漏风险：tempDiv 未在 try-finally 中清理 | 待修复 |
| 2 | PreviewPanel.tsx | 401 | XSS 风险：dangerouslySetInnerHTML 未二次消毒 | 待修复 |
| 3 | main.ts | 137-153 | PDF 生成性能：预渲染后仍等待 3-4 秒 | 待修复 |

### 中等优先级

| # | 文件 | 行号 | 问题 | 严重性 | 状态 |
|---|------|------|------|--------|------|
| 4 | usePDFExport.ts | 7,22,30,80,87 | 使用原生 alert() | 待修复 |
| 5 | main.ts | 36,56,72,86 | console.error 与 logger.error 混用 | 待修复 |
| 6 | preload.ts | 11-12 | 使用 any 类型 | 待修复 |

---

## 问题详细说明

### 问题 1：内存泄漏风险

**位置**: src/renderer/components/PreviewPanel.tsx:176-195

**问题描述**: tempDiv append 到 document.body 后，如果后续代码抛出异常，removeChild 不会执行，导致 DOM 节点泄漏

**代码片段**:
```typescript
tempDiv.innerHTML = section.html;
document.body.appendChild(tempDiv);
await new Promise(resolve => setTimeout(resolve, 100));
const totalHeight = tempDiv.offsetHeight;
document.body.removeChild(tempDiv);  // 若上方抛异常，跳过执行
```

**修复建议**: 使用 try-finally 包裹确保清理

---

### 问题 2：XSS 风险

**位置**: src/renderer/components/PreviewPanel.tsx:401

**问题描述**: dangerouslySetInnerHTML 直接渲染 HTML 内容，虽经 DOMPurify 消毒，但防御性编程应二次消毒

**代码片段**:
```typescript
<div className="preview-markdown" dangerouslySetInnerHTML={{ __html: content.html }} />
```

**修复建议**: 使用 DOMPurify.sanitize 再次消毒

---

### 问题 3：PDF 生成性能

**位置**: src/main/main.ts:137-153

**问题描述**:
- htmlGenerator.ts 已预渲染 Mermaid 为 SVG（第 96-102 行）
- htmlGenerator.ts 已预渲染 MathJax 为 SVG（第 105-111 行）
- 但 main.ts 还等待 3-4 秒

**代码片段**:
```typescript
// 额外等待时间确保 Mermaid/MathJax 渲染完成
setTimeout(resolveOnce, 3000);  // 3秒

// 额外等待以确保动态内容渲染完成
await new Promise(resolve => setTimeout(resolve, 1000));  // 1秒
```

**修复建议**: 移除不必要的延迟

---

### 问题 4：原生 alert

**位置**: src/renderer/hooks/usePDFExport.ts

**问题描述**: 使用浏览器原生 alert() 提示用户，影响用户体验

**代码片段**:
```typescript
alert(t('pdf-export-no-content', locale));
alert(t('pdf-export-success', locale));
```

**修复建议**: 创建 Toast 组件替换

---

### 问题 5：日志不一致

**位置**: src/main/main.ts:36,56,72,86

**问题描述**: 部分使用 console.error，部分使用 logger.error

**修复建议**: 统一使用 logger.error

---

### 问题 6：类型安全

**位置**: src/main/preload.ts:11-12

**问题描述**: 使用 any 类型绕过类型检查

**修复建议**: 定义具体类型

---

## 做得好的地方

1. Zustand store 类型安全且有持久化
2. 设置验证逻辑完整
3. 国际化基础架构良好
4. 主进程 IPC 隔离正确
5. ErrorBoundary 组件存在
6. DOMPurify 消毒配置完整

---

## 审核日期

2026-04-21