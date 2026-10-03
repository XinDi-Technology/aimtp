# Changelog

## v0.2.20 - 2026-10-03

### 工程
- 删除todo文件

## v0.2.19 - 2026-10-03

### 工程
- 删除三条零调用方的主进程 IPC 通道：`generate-pdf`（约 65 行，导出统一走 `pdf:print-from-layout-html`，`usePDFExport` 中的 `exportPdf` 是同名本地函数，非 IPC 调用）、`select-file`（文件导入走 `useFileImport` 的 DOM `<input type=file>`）、`window-state-changed`（maximize / unmaximize 事件发送，渲染进程无订阅）；连带删除 `preload.ts` 的 `exportPdf` / `selectFile` / `onWindowStateChanged` 桥接及 `electron.d.ts` 中对应类型声明，preload 与类型声明同步收敛为一致的 `selectSavePath` / `savePdfToPath` / `printFromLayoutHtml` 三条在用通道
- 删除 `src/shared/i18n.ts` 中随 `select-file` 一并失去引用的 `file-read-error` key（zh / en）

## v0.2.18 - 2026-10-03

### 工程
- 删除 `useAppStore` 中四个零消费的迭代3状态：`exportProgress` / `setExportProgress`（无 set 调用、无读取，连带删除仅为其服务的 `ExportProgressState` 接口）、`lastExportPath` / `setLastExportPath`（无 set 调用，唯一"读取"是 persist `partialize` 的自我持久化）、`layoutDOM` / `setLayoutDOM`（3 处写入、0 处读取，读侧一律走 `layoutDOMManager.getCurrent()`）、`settingChangeCategory` / `setSettingChangeCategory`（3 处写入、0 处读取）；`SettingChangeCategory` 类型保留（`PreviewPanel` 的分类逻辑仍在使用），`ExportOrchestrator.onProgress()` 与 `ExportTypes.ExportProgress` 为同名独立实现，不受影响
- `layoutDOM` 移出 store 同时消除一处重复强引用：store 与 `layoutDOMManager` 各持有一份含 `Document` 的 LayoutDOM，前者阻止 GC，删除后内存收敛为单一持有者
- `lastExportPath` 移出 persist 白名单：旧 localStorage 中的冗余键在 rehydrate 时被自动忽略，无迁移影响
- `PreviewPanel` 移除 2 处 selector 与 6 处状态写入，同步清理 3 个副作用的依赖数组；初始化 `PreviewOrchestrator` 的 `useEffect` 依赖数组改为 `[]`（原依赖仅为两个已删除的 store setter，恒稳定）

## v0.2.17 - 2026-10-03

### 工程
- 删除 `LayoutDOMManager` 中三个零引用成员：`invalidate()`（全库无调用）、`extractMetadata()` 与 `buildProvenance()`（与 `PagedJsAdapter` 内私有同名实现重复且更弱：缺 `flow.total` 精确页数，`webContentsId` 参数化但实际无人传入）；元数据与来源信息统一由 `PagedJsAdapter` 产出
- 删除 `PreviewOrchestrator` 中 `forceRender()` / `getCurrentLayoutDOM()` / `getStats()` 三个无调用方方法，连带清理 `stats` 统计字段、`RenderPathStats` 接口、渲染耗时统计更新与只写不读的 `prevSettings`；`render-complete` 事件的 `durationMs` 保留
- 移除导出取消链路：删除 `ExportOrchestrator.cancel()`、`abortController`、4 处 `checkAborted()` 及 catch 中的 `AbortError` 分支（导出过程无取消入口，该链路恒空转）；进度回调 `onProgress()` 保留，供后续接进度条
- 删除 `src/shared/i18n.ts` 中零引用的 `select-file` / `pdf-filter` 两个 key（主进程 dialog filters 仍使用硬编码文案）
- 删除 `markdown.ts` 中空 `if (options.codeHighlight) {}` 块（代码高亮已在 highlight 回调中处理，行为不变）
- `PreviewPanel` 三处 `layoutDOMManager['hashContent']()` 方括号访问改为 `.hashContent()`

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
