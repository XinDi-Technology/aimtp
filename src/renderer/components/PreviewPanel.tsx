import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { resetMarkdownIt } from '../utils/markdown';
import { renderMermaid } from '../utils/mermaidPlugin';
import { typesetMath } from '../utils/mathjaxPlugin';
import { getHljsTheme, getHljsBaseStyles } from '../utils/hljsThemes';
import { splitMarkdownByH2, PageSection } from '../utils/pageSplitter';
import { parseFrontMatter, formatDate } from '../utils/frontMatter';
import { getCalibratedDPI, getPageDimensionsPixels } from '../utils/dpi';
import { t } from '../../shared/i18n';
import './PreviewPanel.css';

interface PreviewPanelProps {
  className?: string;
}

/**
 * 渲染后的页面接口
 */
interface RenderedPage {
  id: string;
  content: React.ReactNode;
  pageNumber: number;
  hasTopMargin: boolean;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = React.memo(({ className }) => {
  const { markdown, font, extensions, page, locale, cover, headerFooter, preview } = useAppStore();
  const contentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const measureRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomMode, setZoomMode] = React.useState<'fit-width' | 'fit-height' | 'actual'>('fit-width');
  const [actualZoom, setActualZoom] = React.useState<number>(100);
  const [renderedPages, setRenderedPages] = useState<RenderedPage[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  // 从 Front Matter 提取封面元数据
  const frontMatterData = useMemo(() => {
    const { data } = parseFrontMatter(markdown);
    return data;
  }, [markdown]);

  // 封面标题
  const coverTitle = useMemo(() => {
    if (frontMatterData.title) {
      return String(frontMatterData.title);
    }
    const h1Match = markdown.match(/^#\s+(.+)$/m);
    if (h1Match) {
      return h1Match[1].trim();
    }
    return locale === 'zh' ? '文档标题' : 'Document Title';
  }, [frontMatterData.title, markdown, locale]);

  // 封面作者
  const coverAuthor = useMemo(() => {
    return frontMatterData.author ? String(frontMatterData.author) : '';
  }, [frontMatterData.author]);

  // 封面日期
  const coverDate = useMemo(() => {
    return formatDate(frontMatterData.date, locale);
  }, [frontMatterData.date, locale]);

  // 获取校准后的 DPI 和页面像素尺寸
  const dpi = useMemo(() => getCalibratedDPI(preview.calibration), [preview.calibration]);

  const pageDimensions = useMemo(() => {
    return getPageDimensionsPixels(page.size, page.orientation, dpi);
  }, [page.size, page.orientation, dpi]);

  // 计算页面可用内容高度（排除页眉页脚）
  const availableContentHeight = useMemo(() => {
    const mmToPx = (mm: number) => mm * (dpi / 25.4);
    const topMargin = mmToPx(page.margins.top);
    const bottomMargin = mmToPx(page.margins.bottom);
    const headerHeight = headerFooter.enabled ? topMargin : 0;
    const footerHeight = headerFooter.enabled ? bottomMargin : 0;
    return pageDimensions.height - topMargin - bottomMargin - headerHeight - footerHeight;
  }, [pageDimensions, page.margins, dpi, headerFooter.enabled]);

  // 章节分割
  const pages = useMemo(() => {
    return splitMarkdownByH2(markdown);
  }, [markdown]);

  // 生成单个页面的HTML内容
  const pageHtmlList = useMemo(() => {
    const currentTheme = extensions.codeTheme || 'github';
    const themeCss = `${getHljsBaseStyles()}${getHljsTheme(currentTheme)}`;

    return pages.map((pageSection) => {
      try {
        const md = resetMarkdownIt({
          codeHighlight: extensions.codeHighlight,
          showLineNumbers: extensions.showLineNumbers,
          taskLists: extensions.taskLists,
          footnotes: extensions.footnotes,
          mermaid: extensions.mermaid,
          mathJax: extensions.mathJax,
          mark: extensions.mark,
          ins: extensions.ins,
          sub: extensions.sub,
          sup: extensions.sup,
          codeTheme: extensions.codeTheme,
        });

        let result = md.render(pageSection.content);

        if (extensions.githubAlerts) {
          result = result.replace(/:::(\w+)([\s\S]*?):::/g, (_, type, content) => {
            const icons: Record<string, string> = {
              note: 'ℹ️',
              tip: '💡',
              important: '⭐',
              warning: '⚠️',
              danger: '🚨',
            };
            return `<div class="github-alert ${type}">
              <span class="alert-icon">${icons[type] || 'ℹ️'}</span>
              <div class="alert-content">${content.trim()}</div>
            </div>`;
          });
        }

        return { html: result, themeCss };
      } catch (error) {
        console.error('Preview markdown parsing error:', error);
        return { html: `<div class="error-message">Error parsing markdown: ${(error as Error).message}</div>`, themeCss };
      }
    });
  }, [pages, extensions]);

  // 生成动态标题样式
  const headingStyles = useMemo(() => {
    const scale = font.headingScale || 1.2;
    return `
      .markdown-preview h1 { font-size: ${font.baseSize * Math.pow(scale, 5)}px !important; }
      .markdown-preview h2 { font-size: ${font.baseSize * Math.pow(scale, 4)}px !important; }
      .markdown-preview h3 { font-size: ${font.baseSize * Math.pow(scale, 3)}px !important; }
      .markdown-preview h4 { font-size: ${font.baseSize * Math.pow(scale, 2)}px !important; }
      .markdown-preview h5 { font-size: ${font.baseSize * Math.pow(scale, 1)}px !important; }
      .markdown-preview h6 { font-size: ${font.baseSize * Math.pow(scale, 0)}px !important; }
    `;
  }, [font.baseSize, font.headingScale]);

  // 计算分页
  const calculatePagination = useCallback(() => {
    setIsCalculating(true);

    const newPages: RenderedPage[] = [];
    let pageIndex = 1;

    // 计算页码
    const totalContentPages = pages.length || 1;
    const totalPages = totalContentPages + (cover.enabled ? 1 : 0);

    // 生成页眉内容
    const getHeaderContent = () => {
      if (!headerFooter.enabled || !headerFooter.header.content) return '';
      switch (headerFooter.header.content) {
        case 'title': return coverTitle;
        case 'author': return coverAuthor;
        case 'date': return coverDate;
        default: return '';
      }
    };

    // 生成页脚内容
    const getFooterContent = (currentPage: number) => {
      if (!headerFooter.enabled || !headerFooter.footer.content) return null;
      const content = headerFooter.footer.content;
      if (content === 'pageNumber') {
        return String(currentPage);
      } else if (content === 'pageNumberTotal') {
        return `第 ${currentPage} 页 / 共 ${totalPages} 页`;
      }
      switch (content) {
        case 'title': return coverTitle;
        case 'author': return coverAuthor;
        case 'date': return coverDate;
        default: return null;
      }
    };

    // 毫米转像素
    const mmToPx = (mm: number) => mm * (dpi / 25.4);

    // 封面页
    if (cover.enabled) {
      newPages.push({
        id: `cover`,
        content: (
          <div className="a4-page cover-page">
            <div className="cover-content" style={{ textAlign: 'center' }}>
              <h1 style={{
                fontSize: `${font.baseSize * 2.5}px`,
                marginBottom: '20px',
                fontFamily: font.heading,
              }}>
                {coverTitle}
              </h1>
              {coverAuthor && (
                <p className="cover-author" style={{
                  fontSize: `${font.baseSize * 1.5}px`,
                  color: '#666',
                  marginBottom: '10px',
                  fontFamily: font.body,
                }}>
                  {coverAuthor}
                </p>
              )}
              {coverDate && (
                <p className="cover-date" style={{
                  fontSize: `${font.baseSize * 1.2}px`,
                  color: '#999',
                  fontFamily: font.body,
                }}>
                  {coverDate}
                </p>
              )}
            </div>
          </div>
        ),
        pageNumber: pageIndex,
        hasTopMargin: false,
      });
      pageIndex++;
    }

    // 内容页
    pages.forEach((section, sectionIndex) => {
      // 计算当前页码
      const currentPageNumber = pageIndex;
      const displayPageNumber = pageIndex;

      // 创建页面内容
      const pageContent = (
        <div className="a4-page content-page">
          {/* 页眉 */}
          {headerFooter.enabled && headerFooter.header.content && (
            <div
              className="page-header"
              style={{
                position: 'absolute',
                top: `${mmToPx(page.margins.top / 2)}px`,
                left: `${mmToPx(page.margins.left)}px`,
                right: `${mmToPx(page.margins.right)}px`,
                textAlign: headerFooter.header.alignment,
                fontFamily: headerFooter.header.font,
                fontSize: `${font.baseSize * 0.9}px`,
                color: '#666',
              }}
            >
              {getHeaderContent()}
            </div>
          )}

          {/* 内容区域 */}
          <div
            ref={(el) => {
              if (el) contentRefs.current.set(`section-${sectionIndex}`, el);
            }}
            className="markdown-preview section-content"
            data-section-index={sectionIndex}
            style={{
              position: 'relative',
              padding: `${mmToPx(page.margins.top)}px ${mmToPx(page.margins.right)}px ${mmToPx(page.margins.bottom)}px ${mmToPx(page.margins.left)}px`,
              fontFamily: font.body,
            }}
          >
            <style>
              {`.markdown-preview h1, .markdown-preview h2, .markdown-preview h3, 
               .markdown-preview h4, .markdown-preview h5, .markdown-preview h6 {
                font-family: ${font.heading} !important;
              }
              .markdown-preview pre, .markdown-preview code {
                font-family: ${font.code}, monospace !important;
                font-size: inherit !important;
              }
              ${pageHtmlList[sectionIndex]?.themeCss || ''}
              ${headingStyles}`}
            </style>
            <div dangerouslySetInnerHTML={{ __html: pageHtmlList[sectionIndex]?.html || '' }} />
          </div>

          {/* 页脚 */}
          {headerFooter.enabled && headerFooter.footer.content && (
            <div
              className="page-footer"
              style={{
                position: 'absolute',
                bottom: `${mmToPx(page.margins.bottom / 2)}px`,
                left: `${mmToPx(page.margins.left)}px`,
                right: `${mmToPx(page.margins.right)}px`,
                textAlign: headerFooter.footer.alignment,
                fontFamily: headerFooter.footer.font,
                fontSize: `${font.baseSize * 0.9}px`,
                color: '#666',
              }}
            >
              {getFooterContent(displayPageNumber)}
            </div>
          )}
        </div>
      );

      newPages.push({
        id: `section-${sectionIndex}`,
        content: pageContent,
        pageNumber: displayPageNumber,
        hasTopMargin: true,
      });

      pageIndex++;
    });

    setRenderedPages(newPages);
    setIsCalculating(false);
  }, [markdown, pages, cover, coverTitle, coverAuthor, coverDate, font, page, headerFooter, dpi, pageHtmlList, headingStyles]);

  // 当内容变化时重新计算分页
  useEffect(() => {
    calculatePagination();
  }, [calculatePagination]);

  // 渲染 Mermaid 和 MathJax 后重新计算
  useEffect(() => {
    if (renderedPages.length === 0) return;

    const renderDeferredContent = async () => {
      let hasChanges = false;

      for (const [key, ref] of contentRefs.current.entries()) {
        if (!ref) continue;

        if (extensions.mermaid) {
          try {
            await renderMermaid(ref, { suppressErrors: true, resetMmdId: true });
            hasChanges = true;
          } catch (error) {
            console.error(`Mermaid rendering error:`, error);
          }
        }

        if (extensions.mathJax) {
          try {
            await typesetMath(ref);
            hasChanges = true;
          } catch (error) {
            console.error(`MathJax rendering error:`, error);
          }
        }
      }

      if (hasChanges) {
        // 等待渲染完成后再重新计算分页
        setTimeout(() => {
          calculatePagination();
        }, 300);
      }
    };

    renderDeferredContent();
  }, [markdown, extensions.mermaid, extensions.mathJax, calculatePagination]);

  // 处理缩放模式切换
  const handleZoomModeChange = (mode: 'fit-width' | 'fit-height' | 'actual') => {
    setZoomMode(mode);
  };

  // 监听窗口大小变化
  React.useEffect(() => {
    const calculateZoom = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const pageWidthPx = pageDimensions.width;
      const pageHeightPx = pageDimensions.height;

      let newZoom = 100;

      if (zoomMode === 'fit-width') {
        const availableWidth = containerWidth - 80;
        newZoom = (availableWidth / pageWidthPx) * 100;
        newZoom = Math.max(50, Math.min(150, newZoom));
      } else if (zoomMode === 'fit-height') {
        const availableHeight = containerHeight - 120;
        newZoom = (availableHeight / pageHeightPx) * 100;
        newZoom = Math.max(50, Math.min(150, newZoom));
      } else {
        newZoom = 100;
      }

      setActualZoom(Math.round(newZoom));
    };

    calculateZoom();

    window.addEventListener('resize', calculateZoom);
    const observer = new ResizeObserver(calculateZoom);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', calculateZoom);
      observer.disconnect();
    };
  }, [zoomMode, pageDimensions]);

  return (
    <div className={`preview-panel ${className || ''}`}>
      <div className="panel-header">
        <span>{t('preview-panel-title', locale)}</span>
        <div className="zoom-controls">
          <button
            className={`zoom-btn ${zoomMode === 'fit-width' ? 'active' : ''}`}
            onClick={() => handleZoomModeChange('fit-width')}
            title={locale === 'zh' ? '适应宽度' : 'Fit Width'}
          >
            ↔️
          </button>
          <button
            className={`zoom-btn ${zoomMode === 'actual' ? 'active' : ''}`}
            onClick={() => handleZoomModeChange('actual')}
            title={locale === 'zh' ? '实际大小 (100%)' : 'Actual Size (100%)'}
          >
            100%
          </button>
          <button
            className={`zoom-btn ${zoomMode === 'fit-height' ? 'active' : ''}`}
            onClick={() => handleZoomModeChange('fit-height')}
            title={locale === 'zh' ? '适应高度' : 'Fit Height'}
          >
            ↕️
          </button>
        </div>
      </div>

      <div className="preview-with-margins" ref={containerRef}>
        <div
          className="page-stack"
          style={{
            transform: `scale(${actualZoom / 100})`,
            transformOrigin: 'top center',
          }}
        >
          {/* 渲染所有页面 */}
          {renderedPages.map((renderedPage, index) => (
            <React.Fragment key={renderedPage.id}>
              {/* 页面分隔标记 */}
              {index > 0 && (
                <div className="page-divider">
                  <span className="divider-line"></span>
                  <span className="divider-label">
                    {locale === 'zh' ? `第 ${renderedPage.pageNumber} 页` : `Page ${renderedPage.pageNumber}`}
                  </span>
                  <span className="divider-line"></span>
                </div>
              )}
              {/* 页面内容 */}
              <div className="page-wrapper">
                {renderedPage.content}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
});

PreviewPanel.displayName = 'PreviewPanel';
