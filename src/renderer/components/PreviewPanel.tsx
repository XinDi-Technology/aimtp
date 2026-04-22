import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { resetMarkdownIt } from '../utils/markdown';
import { renderMermaid } from '../utils/mermaidPlugin';
import { typesetMath } from '../utils/mathjaxPlugin';
import { getHljsTheme, getHljsBaseStyles } from '../utils/hljsThemes';
import { logger } from '../utils/logger';
import { splitMarkdownByH2 } from '../utils/pageSplitter';
import { parseFrontMatter, formatDate } from '../utils/frontMatter';
import { getCalibratedDPI, getPageDimensionsPixels } from '../utils/dpi';
import { t } from '../../shared/i18n';
import './PreviewPanel.css';

interface PreviewPanelProps {
  className?: string;
}

interface PageContent {
  html: string;
  themeCss: string;
}

interface PagedContent {
  id: string;
  pageNumber: number;
  contentList: PageContent[];
  isCover: boolean;
  // Optional metadata for pagination tracing
  sectionIndex?: number;
  pageIndex?: number;
  totalPages?: number;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = React.memo(({ className }) => {
  const { markdown, font, extensions, page, locale, cover, headerFooter, preview } = useAppStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const contentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [zoomMode, setZoomMode] = React.useState<'fit-width' | 'fit-height' | 'actual'>('fit-width');
  const [actualZoom, setActualZoom] = React.useState<number>(100);
  const [pagedContents, setPagedContents] = useState<PagedContent[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

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
  const dpi = useMemo(() => getCalibratedDPI(preview.targetDPI), [preview.targetDPI]);

  const pageDimensions = useMemo(() => {
    return getPageDimensionsPixels(page.size, page.orientation, dpi);
  }, [page.size, page.orientation, dpi]);

  // 毫米转像素
  const mmToPx = useCallback((mm: number) => mm * (dpi / 25.4), [dpi]);

  // 计算页面可用内容高度
  // 注：页边距已经包含了内容区域与页面边缘的距离
  // 页眉页脚定位在页边距区域内，不需要额外减去高度
  const availableContentHeight = useMemo(() => {
    const topMargin = mmToPx(page.margins.top);
    const bottomMargin = mmToPx(page.margins.bottom);
    // 页面总高度减去上下页边距即为可用内容高度
    // 页眉页脚位于页边距范围内，不单独占用内容空间
    return pageDimensions.height - topMargin - bottomMargin;
  }, [pageDimensions.height, page.margins, mmToPx]);

  // 章节分割
  const sections = useMemo(() => {
    return splitMarkdownByH2(markdown);
  }, [markdown]);

  // 生成章节HTML列表
  const sectionHtmlList = useMemo(() => {
    const currentTheme = extensions.codeTheme || 'github';
    const codeBackgrounds: Record<string, string> = {
      github: '#f6f8fa',
      monokai: '#272822',
      dracula: '#282a36',
    };
    const codeBackground = codeBackgrounds[currentTheme] || codeBackgrounds.github;
    const themeCss = `${getHljsBaseStyles(codeBackground)}${getHljsTheme(currentTheme)}`;

    return sections.map((section) => {
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

        let content = section.content;

        if (extensions.githubAlerts) {
          // 在渲染之前处理 GitHub 语法: > [!TYPE] 后跟多行内容
          const typeLabels: Record<string, string> = {
            note: 'NOTE',
            tip: 'TIP',
            important: 'IMPORTANT',
            warning: 'WARNING',
            danger: 'DANGER',
          };
          // 匹配: > [!TYPE] 标题行和后续所有 > 开头的行
          content = content.replace(/^> \[!(\w+)\][\s\S]*?(?=\n^[^>]|$)/gm, (_, type) => {
            const title = typeLabels[type.toLowerCase()] || 'NOTE';
            return `<div class="github-alert"><div class="alert-title">${title}</div></div>`;
          });
        }

        let result = md.render(content);

        return { html: result, themeCss };
      } catch (error) {
        console.error('Preview markdown parsing error:', error);
        return { html: `<div class="error-message">Error: ${(error as Error).message}</div>`, themeCss };
      }
    });
  }, [sections, extensions]);

  // 生成动态标题样式
  const headingStyles = useMemo(() => {
    const scale = font.headingScale || 1.2;
    return `
      .preview-markdown h1 { font-size: ${font.baseSize * Math.pow(scale, 5)}px !important; }
      .preview-markdown h2 { font-size: ${font.baseSize * Math.pow(scale, 4)}px !important; }
      .preview-markdown h3 { font-size: ${font.baseSize * Math.pow(scale, 3)}px !important; }
      .preview-markdown h4 { font-size: ${font.baseSize * Math.pow(scale, 2)}px !important; }
      .preview-markdown h5 { font-size: ${font.baseSize * Math.pow(scale, 1)}px !important; }
      .preview-markdown h6 { font-size: ${font.baseSize * Math.pow(scale, 0)}px !important; }
    `;
  }, [font.baseSize, font.headingScale]);

  // 核心分页算法：基于逐段测量的分页实现（方案A）
  const calculatePagination = useCallback(async () => {
    if (sectionHtmlList.length === 0 && !cover.enabled) {
      setPagedContents([]);
      return;
    }

    setIsCalculating(true);

    const result: PagedContent[] = [];
    let pageNumber = 1;

    // 封面页
    if (cover.enabled) {
      result.push({
        id: 'cover',
        pageNumber: pageNumber,
        contentList: [],
        isCover: true,
      });
      pageNumber++;
    }

    // 计算可用高度
    const contentWidth = pageDimensions.width - mmToPx(page.margins.left) - mmToPx(page.margins.right);

    // 隐藏测量容器，用于逐段分页
    const measureHost = document.createElement('div');
    measureHost.style.position = 'absolute';
    measureHost.style.visibility = 'hidden';
    measureHost.style.width = `${contentWidth}px`;
    measureHost.style.padding = `${mmToPx(page.margins.top)}px ${mmToPx(page.margins.right)}px ${mmToPx(page.margins.bottom)}px ${mmToPx(page.margins.left)}px`;
    measureHost.style.boxSizing = 'border-box';
    // 应用字体样式以确保测量准确
    measureHost.style.fontFamily = font.body;
    measureHost.style.fontSize = `${font.baseSize}px`;
    measureHost.style.lineHeight = String(font.lineHeight);
    measureHost.className = 'preview-pager-measure';
    document.body.appendChild(measureHost);

    // 当前正在拼装的页
    const currentPageDiv = document.createElement('div');
    currentPageDiv.className = 'preview-markdown';
    measureHost.appendChild(currentPageDiv);

    try {
      // 遍历章节，逐段分页
      for (let si = 0; si < sectionHtmlList.length; si++) {
        const section = sectionHtmlList[si];
        const sectionStartIndex = result.length;
        const container = document.createElement('div');
        container.innerHTML = section.html;
        let currentHTML = '';
        let sectionPageIndex = 0;

        // 将章节内容逐段放入当前页，遇到溢出即切页
        while (container.firstChild) {
          const node = container.firstChild as HTMLElement;
          const candidateHTML = currentHTML + (node.outerHTML || node.textContent || '');
          currentPageDiv.innerHTML = candidateHTML;
          const fits = currentPageDiv.offsetHeight <= availableContentHeight;
          if (fits) {
            currentHTML = candidateHTML;
            container.removeChild(node);
          } else {
            // 处理溢出
            if (currentHTML.trim() === '') {
              // 单个块就超过页面高度，强制单页
              const singleChunk = node.outerHTML || '';
              result.push({
                id: `section-${si}-page-${sectionPageIndex}`,
                pageNumber: pageNumber,
                contentList: [{ html: singleChunk, themeCss: section.themeCss }],
                isCover: false,
                sectionIndex: si,
                pageIndex: sectionPageIndex,
                totalPages: 1
              });
              sectionPageIndex++;
              pageNumber++;
              container.removeChild(node);
              currentHTML = '';
              currentPageDiv.innerHTML = '';
            } else {
              // 保存当前页
              const pageHTML = currentHTML;
              result.push({
                id: `section-${si}-page-${sectionPageIndex}`,
                pageNumber: pageNumber,
                contentList: [{ html: pageHTML, themeCss: section.themeCss }],
                isCover: false,
                sectionIndex: si,
                pageIndex: sectionPageIndex,
                totalPages: 0
              });
              sectionPageIndex++;
              pageNumber++;
              currentHTML = node.outerHTML || '';
              currentPageDiv.innerHTML = currentHTML;
              container.removeChild(node);
            }
          }
        }

        if (currentHTML.trim()) {
          result.push({
            id: `section-${si}-page-${sectionPageIndex}`,
            pageNumber: pageNumber,
            contentList: [{ html: currentHTML, themeCss: section.themeCss }],
            isCover: false,
            sectionIndex: si,
            pageIndex: sectionPageIndex,
            totalPages: 0
          });
          sectionPageIndex++;
          pageNumber++;
        }
        // 回填该章节的总页数到本章节所有页
        const totalForThisSection = sectionPageIndex;
        if (typeof sectionStartIndex !== 'undefined' && sectionStartIndex < result.length) {
          for (let idx = sectionStartIndex; idx < result.length; idx++) {
            const item = result[idx];
            if (item.sectionIndex === si) {
              item.totalPages = totalForThisSection;
            }
          }
        }
      }
    } catch (err) {
      logger.error('Pagination error (方案A):', err);
    } finally {
      if (measureHost.parentNode) measureHost.parentNode.removeChild(measureHost);
    }

    setPagedContents(result);
    setIsCalculating(false);
    setRenderKey(prev => prev + 1);
  }, [sectionHtmlList, cover.enabled, pageDimensions, font, page.margins, mmToPx, availableContentHeight]);

  // 初始计算
  useEffect(() => {
    calculatePagination();
  }, [calculatePagination]);

  // 渲染 Mermaid 和 MathJax
  useEffect(() => {
    if (pagedContents.length === 0) return;

    const renderContent = async () => {
      // 等待DOM更新
      await new Promise(resolve => setTimeout(resolve, 100));

      for (const [key, ref] of contentRefs.current.entries()) {
        if (!ref) continue;

        if (extensions.mermaid) {
          try {
            await renderMermaid(ref, { suppressErrors: true, resetMmdId: true });
          } catch (e) {
            console.error('Mermaid error:', e);
          }
        }

        if (extensions.mathJax) {
          try {
            await typesetMath(ref);
          } catch (e) {
            console.error('MathJax error:', e);
          }
        }
      }

      // 重新计算分页
      setTimeout(() => calculatePagination(), 300);
    };

    renderContent();
  }, [markdown, extensions.mermaid, extensions.mathJax, calculatePagination, pagedContents.length]);

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

  // 页眉页脚内容
  const headerText = useMemo(() => {
    if (!headerFooter.enabled || !headerFooter.header.content) return '';
    switch (headerFooter.header.content) {
      case 'title': return coverTitle;
      case 'author': return coverAuthor;
      case 'date': return coverDate;
      default: return '';
    }
  }, [headerFooter, coverTitle, coverAuthor, coverDate]);

  const getFooterText = (pageNum: number) => {
    if (!headerFooter.enabled || !headerFooter.footer.content) return '';
    const content = headerFooter.footer.content;
    if (content === 'pageNumber') return String(pageNum);
    if (content === 'pageNumberTotal') return `第 ${pageNum} 页 / 共 ${pagedContents.length} 页`;
    switch (content) {
      case 'title': return coverTitle;
      case 'author': return coverAuthor;
      case 'date': return coverDate;
      default: return '';
    }
  };

  const headerTop = mmToPx(page.margins.top / 2);
  const footerBottom = mmToPx(page.margins.bottom / 2);
  const leftMargin = mmToPx(page.margins.left);
  const rightMargin = mmToPx(page.margins.right);
  const contentPaddingTop = mmToPx(page.margins.top);
  const contentPaddingRight = mmToPx(page.margins.right);
  const contentPaddingBottom = mmToPx(page.margins.bottom);
  const contentPaddingLeft = mmToPx(page.margins.left);

  return (
    <div className={`preview-panel ${className || ''}`}>
      <div className="panel-header">
        <span>{t('preview-panel-title', locale)}</span>
        <div className="zoom-controls">
          <button className={`zoom-btn ${zoomMode === 'fit-width' ? 'active' : ''}`} onClick={() => setZoomMode('fit-width')} title={locale === 'zh' ? '适应宽度' : 'Fit Width'}>↔️</button>
          <button className={`zoom-btn ${zoomMode === 'actual' ? 'active' : ''}`} onClick={() => setZoomMode('actual')} title={locale === 'zh' ? '实际大小' : 'Actual'}>100%</button>
          <button className={`zoom-btn ${zoomMode === 'fit-height' ? 'active' : ''}`} onClick={() => setZoomMode('fit-height')} title={locale === 'zh' ? '适应高度' : 'Fit Height'}>↕️</button>
        </div>
      </div>

      <div className="preview-with-margins" ref={containerRef}>
        <div
          className="page-stack"
          key={renderKey}
          style={{ transform: `scale(${actualZoom / 100})`, transformOrigin: 'top center' }}
        >
          {pagedContents.map((pageContent, index) => (
            <React.Fragment key={pageContent.id}>
              {index > 0 && (
                <div className="page-divider">
                  <span className="divider-line" />
                  <span className="divider-label">
                    {locale === 'zh' ? `第 ${pageContent.pageNumber} 页` : `Page ${pageContent.pageNumber}`}
                  </span>
                  <span className="divider-line" />
                </div>
              )}
              
              <div className="page-wrapper">
                {pageContent.isCover ? (
                  // 封面页
                  <div className="a4-page cover-page" style={{ width: pageDimensions.width, height: pageDimensions.height }} data-is-cover="true" data-section-index={pageContent.sectionIndex ?? -1} data-page-index={pageContent.pageIndex ?? -1} data-total-pages={pageContent.totalPages ?? 0}>
                    <div className="cover-content" style={{ textAlign: 'center' }}>
                      <h1 style={{ fontSize: `${font.baseSize * 2.5}px`, marginBottom: '20px', fontFamily: font.heading }}>{coverTitle}</h1>
                      {coverAuthor && (
                        <p className="cover-author" style={{ fontSize: `${font.baseSize * 1.5}px`, color: '#666', marginBottom: '10px', fontFamily: font.body }}>{coverAuthor}</p>
                      )}
                      {coverDate && (
                        <p className="cover-date" style={{ fontSize: `${font.baseSize * 1.2}px`, color: '#999', fontFamily: font.body }}>{coverDate}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  // 内容页
                  <div className="a4-page content-page" style={{ width: pageDimensions.width, height: pageDimensions.height }} data-section-index={pageContent.sectionIndex ?? -1} data-page-index={pageContent.pageIndex ?? -1} data-total-pages={pageContent.totalPages ?? 0}>
                    {pageContent.contentList.map((content, cIndex) => (
                      <React.Fragment key={`${pageContent.id}-${cIndex}`}>
                        <style>{content.themeCss}{headingStyles}</style>
                        
                        {/* 页眉 */}
                        {headerText && (
                          <div className="page-header" style={{
                            position: 'absolute', top: headerTop, left: leftMargin, right: rightMargin,
                            textAlign: headerFooter.header.alignment, fontFamily: headerFooter.header.font,
                            fontSize: `${font.baseSize * 0.9}px`, color: '#666', pointerEvents: 'none'
                          }}>
                            {headerText}
                          </div>
                        )}
                        
                        {/* 内容 */}
                        <div
                          ref={(el) => { if (el) contentRefs.current.set(`${pageContent.id}-${cIndex}`, el); }}
                          className="page-content-area"
                          style={{
                            padding: `${contentPaddingTop}px ${contentPaddingRight}px ${contentPaddingBottom}px ${contentPaddingLeft}px`,
                            fontSize: `${font.baseSize}px`,
                            lineHeight: font.lineHeight,
                            fontFamily: font.body,
                            height: '100%',
                            boxSizing: 'border-box',
                          }}
                        >
                          {/* [TODO] 问题2：XSS 风险，虽已消毒一次，应二次消毒或添加注释说明来源可信 */}
                          <div className="preview-markdown" dangerouslySetInnerHTML={{ __html: content.html }} />
                        </div>
                        
                        {/* 页脚 */}
                        {getFooterText(pageContent.pageNumber) && (
                          <div className="page-footer" style={{
                            position: 'absolute', bottom: footerBottom, left: leftMargin, right: rightMargin,
                            textAlign: headerFooter.footer.alignment, fontFamily: headerFooter.footer.font,
                            fontSize: `${font.baseSize * 0.9}px`, color: '#666', pointerEvents: 'none'
                          }}>
                            {getFooterText(pageContent.pageNumber)}
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
});

PreviewPanel.displayName = 'PreviewPanel';
