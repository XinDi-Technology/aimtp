# 死代码审核报告（2026-10-02）

> **审查对象**：aimtp 全项目（Electron + React + Vite 的 Markdown 转 PDF 桌面应用）
> **审查方法**：基于源码的只读静态审查，所有结论经 Grep 全库交叉验证，无单点推断
> **当前状态**：用户确认**暂不清理**，本报告作为后续清理的参考依据，将多次使用
> **预计收益**：删除约 600+ 行死代码、2 个可整删文件、约 500KB 安装包体积

---

## A. 高置信度死代码（建议删除）

### A1. 三条死 IPC 通道（main.ts + preload.ts + electron.d.ts 联动）

渲染进程实际导出只走 `pdf:print-from-layout-html`（ExportOrchestrator），文件导入只走 DOM `<input type=file>`（useFileImport）。以下通道全库无调用方：

| 位置 | 死代码 | 证据 |
|---|---|---|
| `src/main/main.ts` L101-165 | `generate-pdf` handler（约 65 行） | 全库无 `invoke('generate-pdf')` |
| `src/main/main.ts` L50-64 | `select-file` handler | 文件导入走 useFileImport 的 DOM input |
| `src/main/main.ts` L31-37 | `window-state-changed` 事件发送 | 渲染进程无订阅 |
| `src/main/preload.ts` L4, L8-9, L15-17 | `exportPdf`、`selectFile`、`onWindowStateChanged` 导出 | 上述通道的桥接，连带死 |
| `src/renderer/types/electron.d.ts` | 对应类型声明 + `__aimtpGetLastRenderResult` | 类型与调试钩子均无消费者（钩子调用点在 PreviewPanel.tsx，删除时需同步清理） |

### A2. useAppStore 死状态（约 150 行）

`src/renderer/store/useAppStore.ts`：

| 成员 | 位置 | 说明 |
|---|---|---|
| `generatedHtml` / `setGeneratedHtml` | L146-147, L657-658 | 全库无读取 |
| `autoSaveEnabled` / `setAutoSaveEnabled` | L159-164, L589-616, L733-792 | 自动保存子系统整体空转：应用无编辑器，markdown 只来自模板/导入 |
| `lastSavedAt` / `setLastSavedAt` | 同上 | 同上 |
| `loadAutoSave` / `saveAutoSave` + STORAGE 常量 | 同上 | 同上 |
| `exportProgress` / `setExportProgress` | L173-174, L747-748 | 无 UI 消费 |
| `lastExportPath` / `setLastExportPath` | L177-178, L750-751 | 无 UI 消费 |
| `layoutDOM` / `setLayoutDOM` | — | 只写不读（读侧一律走 `layoutDOMManager.getCurrent()`） |
| `settingChangeCategory` / `setSettingChangeCategory` | — | 只写不读 |

### A3. Handler 空转架构（3 个文件联动）

- `src/renderer/domain/handlers/HandlerRegistry.ts` — **整文件可删**：全库无任何 `register()` 调用，`getAllHandlerClasses()` 永远返回 `[]`（唯一调用点在 PagedJsAdapter.ts L193）
- `src/renderer/domain/handlers/AimtpHandler.ts` — 抽象类无任何子类；仅 `HeaderFooterConfig`、`FrontMatter` 两个类型被 PagedJsAdapter/PreviewPanel 导入使用，文件可缩减为纯类型文件
- `src/renderer/domain/PagedJsAdapter.ts` — 死成员：`registerHandler` / `clearHandlers` / `registeredHandlerConstructors`（L59, L69-76）及 `layout()` 中的 handler 注册块（L191-203）；分页核心（IIFE 注入 + 补丁）不受影响

### A4. mermaidPlugin 死导出（约 150 行）

`src/renderer/utils/mermaidPlugin.ts` 实际只用了 `mermaidPlugin` + `renderMermaidSync`。以下导出为死代码：

- `updateMermaidConfig`
- `initializeMermaidAsync`
- `resetMermaid`
- `renderMermaid`（DOM 容器版）
- `createMermaidContainer`
- `initMermaidInstance`（已标 deprecated）

### A5. 其他文件死成员

| 文件 | 死代码 | 备注 |
|---|---|---|
| `src/renderer/utils/mathjaxPlugin.ts` L383, L387 | `isMathJaxReady`、`initializeMathJax` | 无调用方 |
| `src/renderer/domain/LayoutDOMManager.ts` L22, L75-97, L99-105 | `invalidate()`、`extractMetadata()`、`buildProvenance()` | PagedJsAdapter 内有私有同名实现 |
| `src/renderer/orchestration/PreviewOrchestrator.ts` L127, L139, L144 | `forceRender()`、`getCurrentLayoutDOM()`、`getStats()`、`stats` 统计、`prevSettings`（只写不读） | 无调用方 |
| `src/renderer/orchestration/ExportOrchestrator.ts` | `cancel()`、`onProgress()` | 无调用方 |
| `src/shared/i18n.ts` | `select-file`、`pdf-filter` 两个 key | 无引用 |
| `src/renderer/utils/markdown.ts` L110-112 | 空 if 块 `if (options.codeHighlight) {}` | 可简化 |

### A6. 类型文件死声明

| 文件 | 内容 |
|---|---|
| `src/renderer/types/woff2.d.ts` | **整文件可删**：`*.woff2?base64` 声明全库无引用 |
| `src/renderer/types/css.d.ts` | 含与 pagedjs.d.ts 重复的 `declare module 'pagedjs'` + 死的 `declare module 'mathjax'` 块 |

### A7. 死 CSS（旧版模板 UI 遗留）

`src/renderer/styles/components.css` 可删（旧版下拉/弹窗模板 UI 遗留）：

- `.template-dropdown`、`.template-menu`、`.template-item`（含 `.active`）、`.template-icon`、`.template-info`、`.template-name`、`.template-desc`
- `.template-selection-overlay`、`.template-selection-panel`、`.template-selection-header`
- `.close-btn`
- `.template-grid`、`.template-card`（base/hover/inline 变体）、`.template-card-header`、`.template-card-actions`
- `.panel-header` 系列
- fadeIn / slideUp keyframes

> ⚠️ **注意**：`.template-card-icon`、`.template-card-desc` **在用**（TemplateSelectionPanel.tsx），不可删。

`src/renderer/styles/layout.css` 可删：

- `.toolbar-title`、`.toolbar-divider`、`.btn-text`、`.margin-inputs`
- `.preview-panel.preview-full-width`（PreviewPanel 组件忽略 className prop）

---

## B. 依赖与打包冗余

| 项 | 内容 | 收益 | 风险/备注 |
|---|---|---|---|
| `package.json` | 删 `mathjax`（^4.1.3）devDep：全库无 `import 'mathjax'`，运行时用 git 跟踪的 `public/vendor` 文件 | 减依赖 | 无 |
| `package.json` | 删 `playwright`（^1.63.0）devDep：`@playwright/test` 已内含并提供 bin | 减依赖 | 无（已查 package-lock 确认依赖关系） |
| `electron-builder.json` | 删 extraResources 中 `node_modules/pagedjs/dist/paged.js → paged.js`：无代码加载 resources/paged.js | 安装包 -500KB | 无 |
| `scripts/fix-crossorigin.mjs` | 与 vite.config.ts 内联 fix-crossorigin 插件功能重复，二选一 | 减脚本 | ⚠️ `build:vite` 被 CI lint/test job 引用，改动需同步 `.github/workflows/build.yml` |

---

## C. 确认不可删清单（防误判）

| 路径 | 原因 |
|---|---|
| `src/renderer/public/vendor/mathjax-newcm-font/svg/dynamic/*.js`（38 个文件，约 9.5MB，git 跟踪） | MathJax dynamicPrefix 运行时动态加载必需 |
| `src/renderer/public/vendor/tex-mml-svg-mathjax-newcm.js` | 运行时脚本 |
| `src/renderer/assets/vendor/pagedjs.iife.js` | gitignored 生成物（scripts/build-pagedjs-iife.mjs 生成），运行时必需 |
| extraResources 字体副本（src/fonts → dist/renderer/fonts） | PDF 导出 file:// 路径需要 |
| `src/fonts/README.md` | 字体授权说明 |

---

## D. 可选结构性简化（非死代码，行为不变的重构，风险略高）

- `src/renderer/components/PreviewPanel.tsx`：doFullRender 与 doRender 的完整渲染分支重复（约 50 行 x2），可合并
- `src/renderer/components/PreviewPanel.tsx`：`PreviewPanelProps.className` 被 App.tsx 传入但被组件忽略——要么实现要么删 prop
- 双重防抖（两层 debounce 可精简为一层）
- 双层 ErrorBoundary（可精简为一层）
- `buildHeaderFooterCss` 三个相同分支可合并

---

## 验证方式

按项目规则，任何清理改动后的验证（lint / typecheck / test / build）仅在 **GitHub Actions** 上进行，不在本地安装依赖或测试。

## 使用说明

本报告是 2026-10-02 全量审查的完整结论。若后续执行部分清理，建议：

1. 按分组（A1-A7、B、D）分批提交，每批一个独立 commit
2. 删除带联动关系的项时同步检查关联文件（如 A1 涉及 main.ts/preload.ts/electron.d.ts/PreviewPanel.tsx 四处）
3. 执行后在 CHANGELOG.md 记录（参考 v0.2.11 的死文件清理记录方式）
4. 行号以本报告日期的代码为准，若代码已变动需重新核实行号
