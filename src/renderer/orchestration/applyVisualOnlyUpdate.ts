/**
 * applyVisualOnlyUpdate — CSS 实时反射（visual-only 快速路径）
 *
 * 纯视觉变更的快速 CSS 更新路径：只替换 <style data-aimtp-css> 的 textContent，
 * 不重新分页，浏览器自动增量样式重算和布局重排。
 *
 * 性能目标：~56ms（vs 完整渲染 ~990ms）
 *
 * 用法：
 *   await applyVisualOnlyUpdate(layoutDOM, newCss);
 *   // CSS 已就替换，浏览器自动重算样式
 */

import type { LayoutDOM } from '../domain/LayoutDOM';

/** CSS 更新结果 */
export interface VisualOnlyUpdateResult {
  /** 更新是否成功 */
  success: boolean;
  /** 更新耗时 (ms) */
  durationMs: number;
  /** 找到的 style 元素数量 */
  styleElementsFound: number;
  /** 替换的 CSS 大小 (bytes) */
  cssSizeBytes: number;
  /** 错误信息 */
  error?: string;
}

/** 溢出检测结果 */
export interface OverflowDetectionResult {
  /** 是否有溢出 */
  hasOverflow: boolean;
  /** 溢出的页面列表 */
  overflowPages: { pageIndex: number; scrollHeight: number; clientHeight: number }[];
}

/**
 * 应用纯视觉 CSS 更新
 *
 * 定位 <style data-aimtp-css> 元素（通过 data-aimtp-css 标记），
 * 替换 textContent 为新的 CSS（含 @media screen + @media print 规则），
 * 浏览器自动增量样式重算和布局重排。
 *
 * 不调用 PagedJsAdapter.layout()，不重新分页。
 *
 * @param layoutDOM 当前 Layout DOM
 * @param newCss 新的 CSS 文本
 * @returns 更新结果
 */
export async function applyVisualOnlyUpdate(
  layoutDOM: LayoutDOM,
  newCss: string,
): Promise<VisualOnlyUpdateResult> {
  const startTime = performance.now();

  try {
    const doc = layoutDOM.document;
    const styleElements = doc.querySelectorAll('style[data-aimtp-css]');

    if (styleElements.length === 0) {
      // 降级：尝试查找包含主要 CSS 的 <style> 元素
      const fallbackStyle = findMainStyleElement(doc);
      if (fallbackStyle) {
        fallbackStyle.textContent = newCss;
        const durationMs = performance.now() - startTime;
        return {
          success: true,
          durationMs,
          styleElementsFound: 1,
          cssSizeBytes: newCss.length,
        };
      }

      const durationMs = performance.now() - startTime;
      return {
        success: false,
        durationMs,
        styleElementsFound: 0,
        cssSizeBytes: 0,
        error: 'No <style data-aimtp-css> element found in Layout DOM',
      };
    }

    // 替换所有匹配的 style 元素的 textContent
    styleElements.forEach((styleEl) => {
      (styleEl as HTMLStyleElement).textContent = newCss;
    });

    // 等待浏览器完成样式重算（微任务队列）
    await waitForStyleRecalc(doc);

    const durationMs = performance.now() - startTime;
    return {
      success: true,
      durationMs,
      styleElementsFound: styleElements.length,
      cssSizeBytes: newCss.length,
    };
  } catch (err) {
    const durationMs = performance.now() - startTime;
    return {
      success: false,
      durationMs,
      styleElementsFound: 0,
      cssSizeBytes: 0,
      error: (err as Error).message,
    };
  }
}

/**
 * 异步溢出检测
 *
 * 检查 .pagedjs_page 的 scrollHeight > clientHeight，
 * 如果溢出说明 CSS-only 更新后内容超出了页面边界，
 * 需要触发一次完整渲染修正分页。
 *
 * @param layoutDOM 当前 Layout DOM
 * @returns 溢出检测结果
 */
export function detectOverflow(layoutDOM: LayoutDOM): OverflowDetectionResult {
  const doc = layoutDOM.document;
  const pages = doc.querySelectorAll('.pagedjs_page');
  const overflowPages: OverflowDetectionResult['overflowPages'] = [];

  pages.forEach((pageEl, index) => {
    const el = pageEl as HTMLElement;
    const contentArea = el.querySelector('.pagedjs_page_content') as HTMLElement || el;

    if (contentArea.scrollHeight > contentArea.clientHeight + 2) {
      // +2px 容差，避免浮点精度误判
      overflowPages.push({
        pageIndex: index,
        scrollHeight: contentArea.scrollHeight,
        clientHeight: contentArea.clientHeight,
      });
    }
  });

  return {
    hasOverflow: overflowPages.length > 0,
    overflowPages,
  };
}

// ─── Private Helpers ───

/**
 * 查找主要的 <style> 元素（降级策略）
 *
 * 当 <style data-aimtp-css> 不存在时，尝试查找包含 Paged.js 相关样式
 * 或最大 CSS 内容的 <style> 元素。
 */
function findMainStyleElement(doc: Document): HTMLStyleElement | null {
  const allStyles = doc.querySelectorAll('style');
  let bestMatch: HTMLStyleElement | null = null;
  let bestLength = 0;

  allStyles.forEach((styleEl) => {
    const el = styleEl as HTMLStyleElement;
    const content = el.textContent || '';

    // 优先选择包含 @page 规则的 style（最可能是主 CSS）
    if (content.includes('@page') && content.length > bestLength) {
      bestMatch = el;
      bestLength = content.length;
    }
  });

  // 如果没有找到含 @page 的，选择最大的
  if (!bestMatch) {
    allStyles.forEach((styleEl) => {
      const el = styleEl as HTMLStyleElement;
      const length = el.textContent?.length ?? 0;
      if (length > bestLength) {
        bestMatch = el;
        bestLength = length;
      }
    });
  }

  return bestMatch;
}

/**
 * 等待浏览器完成样式重算
 *
 * 使用 requestAnimationFrame 确保浏览器已处理样式变更。
 */
function waitForStyleRecalc(doc: Document): Promise<void> {
  return new Promise((resolve) => {
    // 使用双重 rAF 确保样式重算完成
    const win = doc.defaultView || window;
    win.requestAnimationFrame(() => {
      win.requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}
