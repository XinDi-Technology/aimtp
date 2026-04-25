import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Previewer } from 'pagedjs';
import { generatePagedPreviewHtml } from '../utils/htmlGenerator';
import { getCalibratedDPI, getPageDimensionsPixels } from '../utils/dpi';
import { parseFrontMatter, formatDate } from '../utils/frontMatter';
import { t } from '../../shared/i18n';
import { wrapPreviewWithErrorHandling } from '../utils/pagedjsPatch';
import './PreviewPanel.css';

interface PreviewPanelProps {
  className?: string;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = React.memo(({ className }) => {
  const { markdown, font, extensions, page, preview, locale, cover, headerFooter } = useAppStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<number | null>(null);

  const [zoomMode, setZoomMode] = useState<'fit-width' | 'fit-height' | 'actual'>('fit-width');
  const [actualZoom, setActualZoom] = useState<number>(100);
  const [isCalculating, setIsCalculating] = useState(false);
  const [totalPages, setTotalPages] = useState(0);

  // 封面元数据
  const frontMatterData = useMemo(() => {
    const { data } = parseFrontMatter(markdown);
    return data;
  }, [markdown]);

  const coverTitle = useMemo(() => {
    if (frontMatterData.title) return String(frontMatterData.title);
    const h1Match = markdown.match(/^#\s+(.+)$/m);
    if (h1Match) return h1Match[1].trim();
    return locale === 'zh' ? '文档标题' : 'Document Title';
  }, [frontMatterData.title, markdown, locale]);

  const coverAuthor = useMemo(() => {
    return frontMatterData.author ? String(frontMatterData.author) : '';
  }, [frontMatterData.author]);

  const coverDate = useMemo(() => {
    return formatDate(frontMatterData.date, locale);
  }, [frontMatterData.date, locale]);

  // 页眉内容
  const headerText = useMemo(() => {
    if (!headerFooter.enabled || !headerFooter.header.content) return '';
    switch (headerFooter.header.content) {
      case 'title': return coverTitle;
      case 'author': return coverAuthor;
      case 'date': return coverDate;
      default: return '';
    }
  }, [headerFooter, coverTitle, coverAuthor, coverDate]);

  // 页脚内容生成
  const getFooterText = useCallback((pageNum: number, total: number) => {
    if (!headerFooter.enabled || !headerFooter.footer.content) return '';
    const content = headerFooter.footer.content;
    if (content === 'pageNumber') return String(pageNum);
    if (content === 'pageNumberTotal') return locale === 'zh' ? `第 ${pageNum} 页 / 共 ${total} 页` : `Page ${pageNum} of ${total}`;
    switch (content) {
      case 'title': return coverTitle;
      case 'author': return coverAuthor;
      case 'date': return coverDate;
      default: return '';
    }
  }, [headerFooter, locale, coverTitle, coverAuthor, coverDate]);

  // 缩放计算
  const calculateZoom = useCallback(() => {
    if (!containerRef.current) return;

    if (zoomMode === 'actual') {
      setActualZoom(100);
      return;
    }

    const container = containerRef.current;
    const containerStyles = window.getComputedStyle(container);
    const availableWidth =
      container.clientWidth -
      parseFloat(containerStyles.paddingLeft) -
      parseFloat(containerStyles.paddingRight);
    const availableHeight =
      container.clientHeight -
      parseFloat(containerStyles.paddingTop) -
      parseFloat(containerStyles.paddingBottom);

    // 始终使用校准 DPI 的理论尺寸，避免 DOM 测量时序和竞争条件问题
    const dpi = getCalibratedDPI(preview.targetDPI);
    const pageDimensions = getPageDimensionsPixels(page.size, page.orientation, dpi);
    const pageWidthPx = pageDimensions.width;
    const pageHeightPx = pageDimensions.height;

    if (!pageWidthPx || !pageHeightPx || availableWidth <= 0 || availableHeight <= 0) {
      return;
    }

    const nextZoom =
      zoomMode === 'fit-width'
        ? (availableWidth / pageWidthPx) * 100
        : (availableHeight / pageHeightPx) * 100;

    setActualZoom(Math.round(Math.min(Math.max(nextZoom, 10), 400)));
  }, [page.orientation, page.size, preview.targetDPI, zoomMode]);

  useEffect(() => {
    calculateZoom();
    window.addEventListener('resize', calculateZoom);
    const observer = new ResizeObserver(calculateZoom);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      window.removeEventListener('resize', calculateZoom);
      observer.disconnect();
    };
  }, [calculateZoom]);

  // 清理 Paged.js 注入的全局样式
  const cleanupPagedJsStyles = useCallback(() => {
    document.querySelectorAll('style').forEach(style => {
      if (
        style.classList.contains('pagedjs-styles') ||
        (style.textContent && style.textContent.includes('.pagedjs_'))
      ) {
        style.remove();
      }
    });
  }, []);

  // Paged.js 分页
  const runPagedJs = useCallback(async () => {
    if (!previewRef.current) return;

    cleanupPagedJsStyles();
    setIsCalculating(true);

    try {
      const html = await generatePagedPreviewHtml({
        markdown,
        locale,
        page,
        font,
        extensions,
        headerFooter,
        cover,
      });

      // 清空之前的内容
      previewRef.current.innerHTML = '';

      // 将 HTML 字符串解析为 DOM 内容，Paged.js preview() 要求传入 DOM 而非字符串
      // generatePagedPreviewHtml 返回完整 <html><head>...</head><body>...</body></html> 结构
      // 浏览器会自动剥离 <html>/<head>/<body> 等外层标签，保留 <style> 和 body 内容
      // 之前因 htmlGenerator.ts 返回 doc.documentElement.outerHTML 导致嵌套 <html> 标签
      // （已修复为 doc.body.innerHTML），现在 innerHTML 方式是安全的
      const content = document.createElement('div');
      content.innerHTML = html;

      const previewer = new Previewer();
      // Paged.js 的 preview 方法：
      // 第一个参数是 DOM 内容（HTMLElement 或 DocumentFragment）
      // 第二个参数是样式表数组
      // 第三个参数是渲染目标（HTMLElement）
      // 使用 wrapPreviewWithErrorHandling 包装，拦截 Paged.js 内部的 DOM 遍历崩溃
      const result = await wrapPreviewWithErrorHandling(
        () => previewer.preview(content, [], previewRef.current!)
      );
      if (!result) {
        // Paged.js 渲染过程中发生了不可恢复的错误，显示降级内容
        if (previewRef.current) {
          previewRef.current.innerHTML = `<div style="padding:20px;color:#d4462a;">${locale === 'zh' ? '预览渲染失败，请尝试简化文档内容' : 'Preview rendering failed, try simplifying the document'}</div>`;
        }
        return;
      }
      setTotalPages(result.total);

      // 注入页眉页脚到预览页面（Paged.js 的 margin box content 只在打印时生效，屏幕上需手动注入）
      if (headerFooter.enabled) {
        result.pages.forEach((pageEl: HTMLElement, index: number) => {
          const pageNum = index + 1;

          // 页眉
          if (headerText) {
            const headerSelector = `.pagedjs_margin-top-${headerFooter.header.alignment}`;
            const headerBox = pageEl instanceof HTMLElement ? pageEl.querySelector(headerSelector) : null;
            if (headerBox) {
              const div = document.createElement('div');
              div.className = 'preview-header-text';
              div.style.cssText = `font-size:${font.baseSize * 0.9}px;color:#666;font-family:${headerFooter.header.font || font.body},sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;text-align:${headerFooter.header.alignment};padding:4px 0;`;
              div.textContent = headerText;
              (headerBox as HTMLElement).appendChild(div);
            }
          }

          // 页脚
          const footerTextContent = getFooterText(pageNum, result.total);
          if (footerTextContent) {
            const footerSelector = `.pagedjs_margin-bottom-${headerFooter.footer.alignment}`;
            const footerBox = pageEl instanceof HTMLElement ? pageEl.querySelector(footerSelector) : null;
            if (footerBox) {
              const div = document.createElement('div');
              div.className = 'preview-footer-text';
              div.style.cssText = `font-size:${font.baseSize * 0.9}px;color:#666;font-family:${headerFooter.footer.font || font.body},sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;text-align:${headerFooter.footer.alignment};padding:4px 0;`;
              div.textContent = footerTextContent;
              (footerBox as HTMLElement).appendChild(div);
            }
          }
        });
      }

      window.requestAnimationFrame(() => {
        calculateZoom();
      });
    } catch (error) {
      console.error('Paged.js preview error:', error);
      // 降级：显示错误信息
      if (previewRef.current) {
        previewRef.current.innerHTML = `<div style="padding:20px;color:#d4462a;">${(error as Error).message}</div>`;
      }
    } finally {
      setIsCalculating(false);
    }
  }, [markdown, locale, page, font, extensions, headerFooter, cover, cleanupPagedJsStyles, headerText, getFooterText, calculateZoom]);

  // 防抖触发 Paged.js
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      runPagedJs();
    }, 300);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [runPagedJs]);

  // 组件卸载时清理 Paged.js 注入的全局样式
  useEffect(() => {
    return () => {
      cleanupPagedJsStyles();
    };
  }, [cleanupPagedJsStyles]);

  return (
    <div className={`preview-panel ${className || ''}`}>
      <div className="panel-header">
        <span>{t('preview-panel-title', locale)}</span>
        <div className="header-right">
          <div className="zoom-controls">
            <button
              className={`zoom-btn ${zoomMode === 'fit-width' ? 'active' : ''}`}
              onClick={() => setZoomMode('fit-width')}
              title={locale === 'zh' ? '适应宽度' : 'Fit Width'}
            >
              ↔️
            </button>
            <button
              className={`zoom-btn ${zoomMode === 'actual' ? 'active' : ''}`}
              onClick={() => setZoomMode('actual')}
              title={locale === 'zh' ? '实际大小' : 'Actual'}
            >
              100%
            </button>
            <button
              className={`zoom-btn ${zoomMode === 'fit-height' ? 'active' : ''}`}
              onClick={() => setZoomMode('fit-height')}
              title={locale === 'zh' ? '适应高度' : 'Fit Height'}
            >
              ↕️
            </button>
          </div>
          {totalPages > 0 && (
            <span className="page-count">
              {locale === 'zh' ? `共 ${totalPages} 页` : `${totalPages} pages`}
            </span>
          )}
        </div>
      </div>

      <div className="preview-with-margins" ref={containerRef}>
        {isCalculating && (
          <div className="pagedjs-loading-overlay">
            <div className="loading-spinner" />
            <span>{locale === 'zh' ? '正在排版...' : 'Typesetting...'}</span>
          </div>
        )}
        <div
          ref={previewRef}
          className="pagedjs-preview-wrapper"
          style={{
            zoom: actualZoom / 100,
            opacity: isCalculating ? 0.3 : 1,
            transition: 'opacity 0.2s ease',
          }}
        />
      </div>
    </div>
  );
});

PreviewPanel.displayName = 'PreviewPanel';
