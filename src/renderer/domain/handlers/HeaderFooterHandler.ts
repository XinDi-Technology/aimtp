/**
 * HeaderFooterHandler — 页眉页脚物化 Handler
 *
 * 在 Paged.js 分页生命周期中同步创建页眉页脚 DOM 元素：
 * - afterPageLayout: 为每页创建页眉/页脚 DOM 元素
 * - afterRendered: 替换 counter(page)/counter(pages) 占位符为实际数值
 * - afterPreview: 移除 CSS @page margin box 内容定义（CSSOM）
 *
 * 继承 AimtpHandler，通过 HandlerRegistry 注册到 PagedJsAdapter。
 */

import { AimtpHandler } from './AimtpHandler';
import type { HeaderFooterConfig, FrontMatter } from './AimtpHandler';
import type { Page } from 'pagedjs';

/** 页眉内容类型 */
type HeaderContentType = 'title' | 'author' | 'date' | 'custom' | 'none';

/** 页脚内容类型 */
type FooterContentType = 'pageNumber' | 'pageNumberTotal' | 'title' | 'author' | 'date' | 'custom' | 'none';

/** 物化结果 */
export interface MaterializeResult {
  /** 物化的页眉数量 */
  headerCount: number;
  /** 物化的页脚数量 */
  footerCount: number;
  /** 封面页跳过数 */
  coverExemptCount: number;
}

export class HeaderFooterHandler extends AimtpHandler {
  private readonly config: HeaderFooterConfig;
  private readonly frontMatter: FrontMatter;
  private totalPages: number = 0;
  private materializeResults: MaterializeResult[] = [];

  constructor(context: { headerFooterConfig: HeaderFooterConfig; frontMatter?: FrontMatter }) {
    super(context);
    this.config = context.headerFooterConfig;
    this.frontMatter = context.frontMatter ?? {};
  }

  // ─── afterPageLayout: 为当前页创建页眉页脚 DOM 元素 ───

  afterPageLayout(pageElement: HTMLElement, page: Page, _breakToken?: unknown): void {
    if (!this.config.enabled) return;

    // 封面页豁免：page.id 为 0 或 pageElement 含 cover-page 类
    const isCoverPage = this.isCoverPage(pageElement, page);
    if (isCoverPage && this.config.coverPageExempt) {
      console.debug('[HeaderFooterHandler] Skipping cover page:', (page as any).position);
      return;
    }

    const result: MaterializeResult = { headerCount: 0, footerCount: 0, coverExemptCount: 0 };

    // 创建页眉 DOM 元素
    if (this.config.header && this.config.header.content !== 'none') {
      const headerEl = this.createHeaderElement(pageElement, page);
      if (headerEl) {
        result.headerCount = 1;
        console.debug('[HeaderFooterHandler] Header injected on page:', (page as any).position);
      } else {
        console.warn('[HeaderFooterHandler] Header injection failed on page:', (page as any).position);
      }
    }

    // 创建页脚 DOM 元素
    if (this.config.footer && this.config.footer.content !== 'none') {
      const footerEl = this.createFooterElement(pageElement, page);
      if (footerEl) {
        result.footerCount = 1;
        console.debug('[HeaderFooterHandler] Footer injected on page:', (page as any).position);
      } else {
        console.warn('[HeaderFooterHandler] Footer injection failed on page:', (page as any).position);
      }
    }

    this.materializeResults.push(result);
  }

  // ─── afterRendered: 替换 counter 占位符 + 移除 margin box 定义 ───

  afterRendered(_pages: Page[]): void {
    if (!this.config.enabled) return;

    // 替换所有 counter 占位符
    this.replaceCounterPlaceholders();

    // 移除 CSS @page margin box 内容定义（CSSOM）
    this.removeMarginBoxDefinitions();
  }

  // ─── afterPreview: 更新总页数引用 ───

  afterPreview(flow: { total: number; pages: Page[] }): void {
    this.totalPages = flow.total;
  }

  // ─── 获取物化统计 ───

  getMaterializeResults(): MaterializeResult[] {
    return [...this.materializeResults];
  }

  // ─── Private Methods ───

  private isCoverPage(pageElement: HTMLElement, page: Page): boolean {
    // 检查 page.id === 0（Paged.js 首页）
    if ((page as any).id === 0) return true;
    // 检查 DOM 中是否有 cover-page 类
    if (pageElement.querySelector('.cover-page')) return true;
    // 检查 pageElement 自身是否是首页（position === 0）
    if ((page as any).position === 0) return true;
    return false;
  }

  private createHeaderElement(pageElement: HTMLElement, page: Page): HTMLElement | null {
    const headerConfig = this.config.header;
    if (!headerConfig || headerConfig.content === 'none') return null;

    const doc = pageElement.ownerDocument;
    const headerEl = doc.createElement('div');
    headerEl.className = 'aimtp-page-header';
    headerEl.setAttribute('data-aimtp-header', 'true');

    // 设置文本内容
    const content = this.resolveHeaderContent(headerConfig.content as HeaderContentType, headerConfig.customText);
    headerEl.textContent = content;

    // 设置对齐方式
    headerEl.style.textAlign = headerConfig.alignment;

    // 设置字体
    if (headerConfig.font) {
      headerEl.style.fontFamily = `"${headerConfig.font}"`;
    }
    if (headerConfig.fontSize) {
      headerEl.style.fontSize = headerConfig.fontSize;
    } else {
      headerEl.style.fontSize = '0.8em';
    }

    // F1: 使用正常流布局，由 margin box 容器的 flex 布局控制位置
    // 不设置 position，使用默认的 static/relative
    headerEl.style.width = '100%';

    // 插入到页面元素的 margin-top 区域
    const marginBox = pageElement.querySelector('.pagedjs_margin-top-center')
      || pageElement.querySelector('.pagedjs_margin-top-left')
      || pageElement.querySelector('.pagedjs_margin-top-right');

    if (marginBox) {
      const marginContent = marginBox.querySelector('.pagedjs_margin-content') || marginBox;
      marginContent.innerHTML = '';
      marginContent.appendChild(headerEl);
    } else {
      // 降级：直接插入到页面元素顶部
      headerEl.style.position = 'relative';
      pageElement.insertBefore(headerEl, pageElement.firstChild);
    }

    return headerEl;
  }

  private createFooterElement(pageElement: HTMLElement, page: Page): HTMLElement | null {
    const footerConfig = this.config.footer;
    if (!footerConfig || footerConfig.content === 'none') return null;

    const doc = pageElement.ownerDocument;
    const footerEl = doc.createElement('div');
    footerEl.className = 'aimtp-page-footer';
    footerEl.setAttribute('data-aimtp-footer', 'true');

    // 设置文本内容（含 counter 占位符）
    const content = this.resolveFooterContent(
      footerConfig.content as FooterContentType,
      footerConfig.customText,
      page,
    );
    footerEl.textContent = content;

    // 设置对齐方式
    footerEl.style.textAlign = footerConfig.alignment;

    // 设置字体
    if (footerConfig.font) {
      footerEl.style.fontFamily = `"${footerConfig.font}"`;
    }
    if (this.config.footer?.fontSize) {
      footerEl.style.fontSize = this.config.footer.fontSize;
    } else {
      footerEl.style.fontSize = '0.8em';
    }

    // F1: 使用正常流布局，由 margin box 容器的 flex 布局控制位置
    // 不设置 position，使用默认的 static/relative
    footerEl.style.width = '100%';

    // 插入到页面元素的 margin-bottom 区域
    const marginBox = pageElement.querySelector('.pagedjs_margin-bottom-center')
      || pageElement.querySelector('.pagedjs_margin-bottom-left')
      || pageElement.querySelector('.pagedjs_margin-bottom-right');

    if (marginBox) {
      const marginContent = marginBox.querySelector('.pagedjs_margin-content') || marginBox;
      marginContent.innerHTML = '';
      marginContent.appendChild(footerEl);
    } else {
      // 降级：直接插入到页面元素底部
      footerEl.style.position = 'relative';
      pageElement.appendChild(footerEl);
    }

    return footerEl;
  }

  private resolveHeaderContent(content: HeaderContentType, customText?: string): string {
    switch (content) {
      case 'title':
        return this.frontMatter.title || '';
      case 'author':
        return this.frontMatter.author || '';
      case 'date':
        return this.frontMatter.date || '';
      case 'custom':
        return customText || '';
      case 'none':
        return '';
      default:
        return '';
    }
  }

  private resolveFooterContent(
    content: FooterContentType,
    customText?: string,
    page?: Page,
  ): string {
    const currentPage = page ? ((page as any).position ?? (page as any).id ?? 0) + 1 : 1;

    switch (content) {
      case 'pageNumber':
        // 使用占位符，在 afterRendered 中替换
        return `{{aimtp:page:${currentPage}}}`;
      case 'pageNumberTotal':
        return `{{aimtp:page-total:${currentPage}}}`;
      case 'title':
        return this.frontMatter.title || '';
      case 'author':
        return this.frontMatter.author || '';
      case 'date':
        return this.frontMatter.date || '';
      case 'custom':
        return customText || '';
      case 'none':
        return '';
      default:
        return '';
    }
  }

  /** 替换 counter 占位符为实际数值 */
  private replaceCounterPlaceholders(): void {
    // 查找所有带占位符的页眉页脚元素
    const selectors = [
      '.aimtp-page-header',
      '.aimtp-page-footer',
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        const text = el.textContent || '';
        if (!text.includes('{{aimtp:')) return;

        let newText = text;
        // 替换 {{aimtp:page:N}} → N
        newText = newText.replace(/\{\{aimtp:page:(\d+)\}\}/g, (_match, pageNum) => {
          return pageNum;
        });
        // 替换 {{aimtp:page-total:N}} → N / totalPages
        newText = newText.replace(/\{\{aimtp:page-total:(\d+)\}\}/g, (_match, pageNum) => {
          return `${pageNum} / ${this.totalPages}`;
        });

        el.textContent = newText;
      });
    }
  }

  /** 移除 CSS @page margin box 内容定义（CSSOM 操作），返回移除的规则数量 */
  removeMarginBoxDefinitions(): number {
    let removedCount = 0;
    try {
      // 遍历所有样式表
      for (const stylesheet of document.styleSheets) {
        try {
          const rules = stylesheet.cssRules || stylesheet.rules;
          if (!rules) continue;

          // 收集需要移除的规则索引（从后往前移除，避免索引偏移）
          const rulesToRemove: number[] = [];

          for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];

            // 检查是否是 @page 规则
            if (rule instanceof CSSPageRule) {
              // @page 规则本身保留（可能含 size/margin 等重要属性）
              continue;
            }

            // 检查是否是 @page margin box 规则
            // Paged.js 将 @page margin box 展开为 .pagedjs_margin-* 样式
            // 我们需要移除 Paged.js 生成的 margin box content 样式
            if (rule instanceof CSSStyleRule) {
              const selectorText = rule.selectorText;
              // 匹配 Paged.js margin box 选择器
              if (
                selectorText.includes('.pagedjs_margin') &&
                selectorText.includes('.hasContent')
              ) {
                // 仅移除含 content 属性的 margin box 规则
                const cssText = rule.cssText;
                if (cssText.includes('content:')) {
                  rulesToRemove.push(i);
                }
              }
            }
          }

          // 从后往前移除，避免索引偏移
          for (let i = rulesToRemove.length - 1; i >= 0; i--) {
            stylesheet.deleteRule(rulesToRemove[i]);
            removedCount++;
          }
        } catch (e) {
          // 跨域样式表会抛出 SecurityError，跳过
          if ((e as Error).name !== 'SecurityError') {
            console.warn('[HeaderFooterHandler] Error processing stylesheet:', e);
          }
        }
      }
    } catch (e) {
      console.warn('[HeaderFooterHandler] removeMarginBoxDefinitions error:', e);
    }
    console.debug('[HeaderFooterHandler] removeMarginBoxDefinitions: removed', removedCount, 'rules');
    return removedCount;
  }
}
