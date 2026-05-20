/**
 * HeaderFooterMaterializer — 页眉页脚物化逻辑
 *
 * 将 CSS @page margin box 内容物化为真实 DOM 元素。
 * 此模块提供独立的物化函数，供 HeaderFooterHandler 和外部直接调用。
 *
 * 流程：
 * 1. 查询所有页面的 margin box DOM 结构
 * 2. 解析页眉页脚配置（内容类型、对齐方式）
 * 3. 为每页创建页眉页脚 DOM 元素
 * 4. 替换 counter(page) 和 counter(pages) 为实际数值
 * 5. 处理封面页豁免
 * 6. 移除 CSS @page margin box 内容定义（CSSOM 操作）
 */

import type { HeaderFooterConfig, FrontMatter } from './handlers/AimtpHandler';
import type { LayoutDOM } from './LayoutDOM';
import DOMPurify from 'dompurify';

/** 物化选项 */
export interface MaterializeOptions {
  /** 页眉页脚配置 */
  config: HeaderFooterConfig;
  /** Front matter 元数据 */
  frontMatter: FrontMatter;
}

/** 物化结果 */
export interface MaterializeResult {
  /** 物化的页眉数量 */
  headerCount: number;
  /** 物化的页脚数量 */
  footerCount: number;
  /** 封面页跳过数 */
  coverExemptCount: number;
  /** 是否执行了 margin box 移除 */
  marginBoxRemoved: boolean;
}

/**
 * 在给定 Layout DOM 中物化页眉页脚
 *
 * @param layoutDOM Layout DOM（就地修改）
 * @param options 物化选项
 * @returns 物化结果
 */
export function materialize(layoutDOM: LayoutDOM, options: MaterializeOptions): MaterializeResult {
  const doc = layoutDOM.document;
  const { config, frontMatter } = options;

  if (!config.enabled) {
    return { headerCount: 0, footerCount: 0, coverExemptCount: 0, marginBoxRemoved: false };
  }

  const pages = doc.querySelectorAll('.pagedjs_page');
  let headerCount = 0;
  let footerCount = 0;
  let coverExemptCount = 0;

  pages.forEach((pageElement, index) => {
    const el = pageElement as HTMLElement;

    // 封面页豁免
    if (config.coverPageExempt && (index === 0 || el.querySelector('.cover-page'))) {
      coverExemptCount++;
      return;
    }

    // 创建页眉
    if (config.header && config.header.content !== 'none') {
      if (createHeaderInPage(el, config, frontMatter, doc)) {
        headerCount++;
      }
    }

    // 创建页脚
    if (config.footer && config.footer.content !== 'none') {
      if (createFooterInPage(el, config, frontMatter, doc, index, pages.length)) {
        footerCount++;
      }
    }
  });

  // 移除 CSS @page margin box 内容定义
  const marginBoxRemoved = removeMarginBoxDefinitions(doc);

  return { headerCount, footerCount, coverExemptCount, marginBoxRemoved };
}

/**
 * 从 DOM 中移除 CSS @page margin box 内容定义（CSSOM 操作）
 *
 * 遍历所有样式表，移除 Paged.js 生成的 margin box content 规则，
 * 避免与 DOM 元素化的页眉页脚冲突。
 */
export function removeMarginBoxDefinitions(doc: Document): boolean {
  let removed = false;

  try {
    for (const stylesheet of doc.styleSheets) {
      try {
        const rules = stylesheet.cssRules || stylesheet.rules;
        if (!rules) continue;

        const rulesToRemove: number[] = [];

        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i];

          if (rule instanceof CSSStyleRule) {
            const selectorText = rule.selectorText;
            // 匹配 Paged.js margin box 选择器（含 hasContent 类）
            if (
              selectorText.includes('.pagedjs_margin') &&
              selectorText.includes('.hasContent')
            ) {
              const cssText = rule.cssText;
              if (cssText.includes('content:')) {
                rulesToRemove.push(i);
              }
            }
          }
        }

        // 从后往前移除
        for (let i = rulesToRemove.length - 1; i >= 0; i--) {
          stylesheet.deleteRule(rulesToRemove[i]);
          removed = true;
        }
      } catch (e) {
        if ((e as Error).name !== 'SecurityError') {
          console.warn('[HeaderFooterMaterializer] Error processing stylesheet:', e);
        }
      }
    }
  } catch (e) {
    console.warn('[HeaderFooterMaterializer] removeMarginBoxDefinitions error:', e);
  }

  return removed;
}

// ─── Private Helpers ───

function createHeaderInPage(
  pageEl: HTMLElement,
  config: HeaderFooterConfig,
  frontMatter: FrontMatter,
  doc: Document,
): boolean {
  const headerConfig = config.header;
  if (!headerConfig) return false;

  const content = resolveHeaderContent(headerConfig.content, frontMatter, headerConfig.customText);
  if (!content) return false;

  const headerEl = doc.createElement('div');
  headerEl.className = 'aimtp-page-header';
  headerEl.setAttribute('data-aimtp-header', 'true');
  headerEl.innerHTML = DOMPurify.sanitize(content);
  headerEl.style.textAlign = headerConfig.alignment;

  if (headerConfig.font) {
    headerEl.style.fontFamily = `"${headerConfig.font}"`;
  }
  headerEl.style.fontSize = headerConfig.fontSize ?? '0.8em';

  // 插入到 margin-top 区域
  const marginBox = pageEl.querySelector('.pagedjs_margin-top-center')
    || pageEl.querySelector('.pagedjs_margin-top-left')
    || pageEl.querySelector('.pagedjs_margin-top-right');

  if (marginBox) {
    const marginContent = marginBox.querySelector('.pagedjs_margin-content') || marginBox;
    marginContent.innerHTML = '';
    marginContent.appendChild(headerEl);
  } else {
    pageEl.insertBefore(headerEl, pageEl.firstChild);
  }

  return true;
}

function createFooterInPage(
  pageEl: HTMLElement,
  config: HeaderFooterConfig,
  frontMatter: FrontMatter,
  doc: Document,
  pageIndex: number,
  totalPages: number,
): boolean {
  const footerConfig = config.footer;
  if (!footerConfig) return false;

  const content = resolveFooterContent(
    footerConfig.content,
    frontMatter,
    footerConfig.customText,
    pageIndex + 1,
    totalPages,
  );
  if (!content) return false;

  const footerEl = doc.createElement('div');
  footerEl.className = 'aimtp-page-footer';
  footerEl.setAttribute('data-aimtp-footer', 'true');
  footerEl.innerHTML = DOMPurify.sanitize(content);
  footerEl.style.textAlign = footerConfig.alignment;

  if (footerConfig.font) {
    footerEl.style.fontFamily = `"${footerConfig.font}"`;
  }
  footerEl.style.fontSize = footerConfig.fontSize ?? '0.8em';

  // 插入到 margin-bottom 区域
  const marginBox = pageEl.querySelector('.pagedjs_margin-bottom-center')
    || pageEl.querySelector('.pagedjs_margin-bottom-left')
    || pageEl.querySelector('.pagedjs_margin-bottom-right');

  if (marginBox) {
    const marginContent = marginBox.querySelector('.pagedjs_margin-content') || marginBox;
    marginContent.innerHTML = '';
    marginContent.appendChild(footerEl);
  } else {
    pageEl.appendChild(footerEl);
  }

  return true;
}

function resolveHeaderContent(
  content: string,
  frontMatter: FrontMatter,
  customText?: string,
): string {
  switch (content) {
    case 'title': return frontMatter.title || '';
    case 'author': return frontMatter.author || '';
    case 'date': return frontMatter.date || '';
    case 'custom': return customText || '';
    case 'none': return '';
    default: return content || ''; // 直接文本内容
  }
}

function resolveFooterContent(
  content: string,
  frontMatter: FrontMatter,
  customText: string | undefined,
  currentPage: number,
  totalPages: number,
): string {
  if (content === 'pageNumber') {
    return String(currentPage);
  }
  if (content === 'pageNumberTotal') {
    return `${currentPage} / ${totalPages}`;
  }
  if (content === 'title') return frontMatter.title || '';
  if (content === 'author') return frontMatter.author || '';
  if (content === 'date') return frontMatter.date || '';
  if (content === 'custom') return customText || '';
  if (content === 'none') return '';
  return content || '';
}
