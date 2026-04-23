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
  const { markdown, font, extensions, page, locale, cover, headerFooter } = useAppStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<number | null>(null);

  const [zoomMode, setZoomMode] = useState<'fit-width' | 'fit-height' | 'actual'>('fit-width');
  const [actualZoom, setActualZoom] = useState<number>(100);
  const [isCalculating, setIsCalculating] = useState(false);
  const [totalPages, setTotalPages] = useState(0);

  // DPI 和页面尺寸（用于缩放计算）
  const dpi = useMemo(() => getCalibratedDPI(300), []);
  const pageDimensions = useMemo(() => {
    return getPageDimensionsPixels(page.size, page.orientation, dpi);
  }, [page.size, page.orientation, dpi]);

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
  useEffect(() => {
    const calculateZoom = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const pageWidthPx = pageDimensions.width;
      const pageHeightPx = pageDimensions.height;
      let newZoom = 100;
      if (zoomMode === 'fit-width') {
        newZoom = Math.max(50, Math.min(150, ((containerWidth - 80) / pageWidthPx) * 100));
      } else if (zoomMode === 'fit-height') {
        newZoom = Math.max(50, Math.min(150, ((containerHeight - 120) / pageHeightPx) * 100));
      } else {
        newZoom = 100;
      }
      setActualZoom(Math.round(newZoom));
    };
    calculateZoom();
    window.addEventListener('resize', calculateZoom);
    const observer = new ResizeObserver(calculateZoom);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      window.removeEventListener('resize', calculateZoom);
      observer.disconnect();
    };
  }, [zoomMode, pageDimensions]);

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
      // 用 DOMParser 解析后提取 body 内容和 <style> 标签，确保结构正确
      // 直接 innerHTML 塞进 div 在之前会导致嵌套 <html> 标签（已修复），
      // 但 DOMParser 方式更可靠：它能正确解析 <style> 中的 @page 等 CSS 规则
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // 将 <style> 标签和 body 内容组装到一个 DocumentFragment 中传给 Paged.js
      const fragment = document.createDocumentFragment();

      // 先加入样式标签（Paged.js 需要解析 @page 等 CSS 规则）
      doc.head.querySelectorAll('style').forEach(style => {
        fragment.appendChild(document.adoptNode(style));
      });

      // 再加入 body 内容
      while (doc.body.firstChild) {
        fragment.appendChild(document.adoptNode(doc.body.firstChild));
      }

      const previewer = new Previewer();
      // Paged.js 的 preview 方法：
      // 第一个参数是 DOM 内容（HTMLElement 或 DocumentFragment）
      // 第二个参数是样式表数组（此处为空，样式已嵌入 fragment 中的 <style> 标签）
      // 第三个参数是渲染目标（HTMLElement）
      // 使用 wrapPreviewWithErrorHandling 包装，拦截 Paged.js 内部的 DOM 遍历崩溃
      const result = await wrapPreviewWithErrorHandling(
        () => previewer.preview(fragment, [], previewRef.current!)
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
            const headerBox = pageEl.querySelector(headerSelector);
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
            const footerBox = pageEl.querySelector(footerSelector);
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
    } catch (error) {
      console.error('Paged.js preview error:', error);
      // 降级：显示错误信息
      if (previewRef.current) {
        previewRef.current.innerHTML = `<div style="padding:20px;color:#d4462a;">${(error as Error).message}</div>`;
      }
    } finally {
      setIsCalculating(false);
    }
  }, [markdown, locale, page, font, extensions, headerFooter, cover, cleanupPagedJsStyles, headerText, getFooterText]);

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
            transform: `scale(${actualZoom / 100})`,
            transformOrigin: 'top center',
            opacity: isCalculating ? 0.3 : 1,
            transition: 'opacity 0.2s ease',
          }}
        />
      </div>
    </div>
  );
});

PreviewPanel.displayName = 'PreviewPanel';
