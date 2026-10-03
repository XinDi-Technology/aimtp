/**
 * Paged.js 0.5.0-beta.2 type definitions
 *
 * 运行时 pagedjs 由 scripts/build-pagedjs-iife.mjs 打成 IIFE 注入 iframe，
 * 不经由模块导入，故本文件仅声明实际消费的类型（Flow）。
 * Previewer 实例的形态见 PagedJsAdapter.PreviewerInstance / PagedJsBridge。
 */
declare module 'pagedjs' {
  export interface Page {
    id: number;
    element: HTMLElement;
    position: number;
    total: number;
  }

  export interface Flow {
    total: number;
    pages: Page[];
  }
}
