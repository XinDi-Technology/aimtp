# Changelog

## v0.2.35 - 2026-10-05

### 优化
- 图片适配比例由 0.97 回调至 0.96.


## v0.2.34 - 2026-10-05

### 优化
- 图片适配比例由 0.98 回调至 0.97.

## v0.2.33 - 2026-10-05

### 优化
- 图片适配比例由 0.85 上调至 0.98，分页时图片更大（更接近原图尺寸）

## v0.2.32 - 2026-10-05

### 优化
- 图片适配比例由 0.85 上调至 0.95，分页时图片更大（更接近原图尺寸）

## v0.2.31 - 2026-10-04

### 工程
- 修复 ESLint 报错：移除 PreviewPanel 中多余的 eslint-disable 指令（未使用的禁用注释触发 `--report-unused-disable-directives` 错误）

## v0.2.30 - 2026-10-04

### 工程
- 修复 ESLint 警告：PreviewPanel 中 useCallback 的 renderNonce 未使用依赖（`exhaustive-deps`）

## v0.2.29 - 2026-10-04

### 修复
- 再次尝试修复图片跨页后整块消失-连续多张图只有第一张显示
- 修复导入文件后重新渲染

## v0.2.28 - 2026-10-04

### 修复
- 再次尝试修复图片跨页后整块消失-连续多张图只有第一张显示

## v0.2.27 - 2026-10-04

### 修复
- 再次尝试修复超高图片在分页后整块消失

## v0.2.26 - 2026-10-04

### 修复
- 修复控制台报警

## v0.2.25 - 2026-10-04

### 修复
- 修复图片跨页后整块消失-连续多张图只有第一张显示

## v0.2.24 - 2026-10-04

### 修复
- 修复超高图片在分页后整块消失

### 工程
- 依赖升级

## v0.2.23 - 2026-10-04

### 优化
- 移除 `src/renderer/index.html` 中 6 条字体 preload

### 修复
- 修复超高图片在分页后整块消失（当前页与下一页均找不到 `<img>`）

## v0.2.22 - 2026-10-03

### 工程
- 裁剪 `types/pagedjs.d.ts` 由 141 行至 20 行：运行时 pagedjs 经 `scripts/build-pagedjs-iife.mjs` 打成 IIFE 注入 iframe、不经由模块导入，故仅保留实际消费的 `Flow` 及其成员类型 `Page`，删除五个 `Previewer*` 事件接口、`Previewer` / `HandlerContext` / `Handler` / `Chunker` / `Polisher` 类与自定义 Handler 注册中心的残留声明（`registerHandlers` / `initializeHandlers` / `registeredHandlers`）；连带删除 `PagedJsAdapter.PagedJsBridge` 接口中 `Handler` / `Chunker` / `Polisher` 三个零引用字段。
- 收敛模块导出：`cssTemplate.ts` 的 `CssVariables` / `buildCssVariables` / `interpolate` 与 `CssVariableCategories.ts` 的三个 `*_VARIABLES` 列表去掉 `export` 改为模块内部使用，并删除零引用的 `CssVariableCategories` 接口。
- 删除 `CSS_VARIABLE_CATEGORIES` 常量及其 getter `SettingChangeClassifier.getVariableCategories()`：该常量的唯一使用点正是这个自身零调用的 getter，二者构成共同死簇，须一次清除（仅去掉 export 会因触发 `no-unused-vars` 导致 CI 的 `--max-warnings 0` 失败）；三个 `*_VARIABLES` 仍服务于 `VARIABLE_CATEGORY_MAP`
- 删除 `markdown.ts` 的 `resetMarkdownIt`（4 行）：它是 `createMarkdownIt` 的纯别名，且其 `reset` 命名具误导性 —— 既不清理缓存也不重置状态，缓存命中时直接返回既有实例；`htmlGenerator.ts` 改用 `createMarkdownIt`。
- 消除 `SettingChangeCategory` 类型重复定义：`useAppStore.ts` 保留唯一定义源，`SettingChangeClassifier.ts` 改为重导出（store 是三者中最底层的模块，反向做会引入 `store → orchestration` 的循环依赖）。

## v0.2.21 - 2026-10-03

### 工程
- 删除 `scripts/fix-crossorigin.mjs`（18 行）：其逻辑与 `vite.config.ts` 内联的 `fix-crossorigin` 插件逐字相同（均对构建产物 `index.html` 执行同一条 `crossorigin` 正则替换），属重复实现；连带删除仅用于触发它的 `build:vite` npm 脚本。经查证 `npm run dist` 链路（`dist → build → build:renderer`）从未包含该脚本，其唯一调用入口仅存在于 CI，因此**对打包安装包零影响**
- CI 收敛：删除 lint job 的 `Build Vite` 步骤，test job 构建命令由 `build:vite` 改为 `build:renderer` 并补 `NODE_OPTIONS: '--max-old-space-size=4096'`。Linux 构建由 2 次降为 1 次，每次 push 省约 1.5-3 分钟；同时修复「同一构建命令在 lint 有内存限制、在 test 却没有」的不一致
- 删除 `useAppStore` 中零读写的 `generatedHtml` / `setGeneratedHtml`（4 行）：全项目无任何读取或调用点，且从未写入 persist `partialize` 白名单，localStorage 无历史数据，无迁移影响
- 删除两份 logger（`src/main/logger.ts` 与 `src/renderer/utils/logger.ts`）中零调用的 `info()` 方法（各 5 行）：`log` / `warn` / `error` / `debug` 均有实际使用，仅 `info` 无人问津；两份文件仍各自保留（主进程读 `process.env.NODE_ENV`、渲染进程读 `import.meta.env.PROD`），维持「除首行外逐行相同」的既有对称性
- 删除 `scripts/build-pagedjs-iife.mjs` 注入的 `window.__pagedjs.createHandler`（3 行）：全项目无调用方，自定义 Paged.js Handler 机制已随早期版本移除；`createPreviewer` 保留，分页与预览行为零变化
- 删除 `PreviewPanel.tsx` 中未被使用的 default 导出（1 行）：唯一导入方 `App.tsx` 使用具名导入，删除后组件层导出方式统一为 named（`App.tsx` 作为应用根组件保留 default，属有意设计）
- 删除 `base.css` 与 `layout.css` 中失效的浏览器前缀 `-moz-user-select` / `-ms-user-select`（共 4 行）：应用唯一运行环境为 Electron（Chromium 内核），Gecko / Trident 前缀永不生效且被直接忽略；保留 `-webkit-user-select`、`::-webkit-scrollbar` 系列与 `-webkit-print-color-adjust`

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
