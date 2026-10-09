/** 主进程持久化的模板记录（与 src/main/templateStore.ts 中的 TemplateRecord 保持一致） */
export interface TemplateRecord {
  id: string;
  name: string;
  settings: unknown;
  createdAt: number;
}

declare global {
  /** MathJax v4 outputJax 结构（最小类型，仅声明实际用到的成员） */
  interface MathJaxOutputJax {
    font?: {
      options?: { dynamicPrefix?: string; [key: string]: unknown };
      loadDynamicFiles?: () => Promise<unknown>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }

  /** MathJax v4 全局对象（由 vendor/tex-mml-svg-mathjax-newcm.js 注入） */
  interface MathJaxGlobal {
    startup?: {
      promise?: Promise<unknown>;
      adaptor?: { outerHTML?: (node: unknown) => string };
      outputJax?: MathJaxOutputJax;
      document?: { outputJax?: MathJaxOutputJax };
    };
    config?: { dynamicPrefix?: string };
    tex2svg?: (math: string, options?: { display?: boolean }) => unknown;
    tex2svgPromise?: (math: string, options?: { display?: boolean }) => Promise<unknown>;
    handleRetriesFor?: (fn: () => unknown) => Promise<unknown>;
    typesetPromise?: (elements?: HTMLElement[]) => Promise<unknown>;
  }

  interface Window {
    /** Electron preload 暴露的 API（与 src/main/preload.ts 保持一致） */
    electronAPI?: {
      selectSavePath: () => Promise<string | null>;
      savePdfToPath: (data: Uint8Array, filePath: string) => Promise<string>;
      printFromLayoutHtml: (
        layoutHtml: string,
        pageConfig: { size: string; orientation: string },
        metadata?: { title?: string; author?: string; subject?: string; keywords?: string[] },
      ) => Promise<Uint8Array>;
      /** 自定义模板读写（文件位于 userData/templates，卸载时保留） */
      templates?: {
        list: () => Promise<TemplateRecord[]>;
        save: (record: TemplateRecord) => Promise<void>;
        remove: (id: string) => Promise<void>;
        clear: () => Promise<void>;
        dir: () => Promise<string>;
        openDir: () => Promise<void>;
      };
    };
    /** PreviewPanel 注册的最近一次预览渲染结果 */
    __aimtpGetLastRenderResult?: () => {
      html: string;
      totalPages: number;
    } | null;
    /** Paged.js 桥接对象（由 pagedjs-iife 注入 iframe） */
    __pagedjs?: { createPreviewer?: () => unknown };
    /** MathJax v4 全局对象 */
    MathJax?: MathJaxGlobal;
  }
}
