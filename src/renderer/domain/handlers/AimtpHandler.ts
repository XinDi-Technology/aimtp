/**
 * AimtpHandler — Aimtp 专用的 Paged.js Handler 基类
 *
 * 继承 Paged.Handler，提供 Aimtp 上下文（headerFooterConfig、frontMatter 等），
 * 简化自定义 Handler 的开发。
 *
 * 用法：
 *   class MyHandler extends AimtpHandler {
 *     constructor() { super({ headerFooterConfig: myConfig }); }
 *     afterPageLayout(pageElement, page, breakToken) { ... }
 *   }
 */

import type { Handler, Page } from 'pagedjs';

/** 页眉页脚配置 */
export interface HeaderFooterConfig {
  enabled: boolean;
  header?: {
    content: 'title' | 'author' | 'date' | 'custom' | 'none';
    customText?: string;
    alignment: 'left' | 'center' | 'right';
    font?: string;
    fontSize?: string;
  };
  footer?: {
    content: 'pageNumber' | 'pageNumberTotal' | 'custom' | 'none';
    customText?: string;
    alignment: 'left' | 'center' | 'right';
    font?: string;
    fontSize?: string;
  };
  coverPageExempt: boolean;
}

/** Front matter 元数据 */
export interface FrontMatter {
  title?: string;
  author?: string;
  date?: string;
}

/** Aimtp Handler 上下文 — 传递给所有 AimtpHandler 子类 */
export interface AimtpHandlerContext {
  headerFooterConfig?: HeaderFooterConfig;
  frontMatter?: FrontMatter;
}

export abstract class AimtpHandler {
  /** Aimtp 上下文 */
  protected readonly context: AimtpHandlerContext;

  /** Paged.js 内部引用（由 initializeHandlers 设置） */
  public chunker: unknown;
  public polisher: unknown;
  public caller: unknown;

  constructor(context: AimtpHandlerContext = {}) {
    this.context = context;
    this.chunker = null;
    this.polisher = null;
    this.caller = null;
  }

  // ─── Previewer-level hooks ───

  beforePreview(_content: string | HTMLElement, _stylesheets?: string[]): void {
    // override in subclass
  }

  afterPreview(_flow: { total: number; pages: Page[] }): void {
    // override in subclass
  }

  // ─── Page-level hooks ───

  beforePageLayout(_pageElement: HTMLElement, _breakToken?: unknown): void {
    // override in subclass
  }

  afterPageLayout(
    _pageElement: HTMLElement,
    _page: Page,
    _breakToken?: unknown,
  ): void {
    // override in subclass
  }

  // ─── Layout-level hooks ───

  beforeLayout(_fragment: HTMLElement, _page: Page): void {
    // override in subclass
  }

  afterLayout(_fragment: HTMLElement, _page: Page): void {
    // override in subclass
  }

  // ─── Rendered hooks ───

  afterRendered(_pages: Page[]): void {
    // override in subclass
  }

  // ─── Polisher-level hooks ───

  beforePolisher(_content: string | HTMLElement): void {
    // override in subclass
  }

  afterPolisher(): void {
    // override in subclass
  }

  // ─── At-page hooks ───

  onAtPage(_page: Page): void {
    // override in subclass
  }
}
