import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { resetMarkdownIt } from '../utils/markdown';
import { renderMermaid } from '../utils/mermaidPlugin';
import { typesetMath } from '../utils/mathjaxPlugin';
import { getHljsTheme, getHljsBaseStyles } from '../utils/hljsThemes';
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
  const dpi = useMemo(() => getCalibratedDPI(preview.calibration), [preview.calibration]);

  const pageDimensions = useMemo(() => {
    return getPageDimensionsPixels(page.size, page.orientation, dpi);
  }, [page.size, page.orientation, dpi]);

  // 毫米转像素
  const mmToPx = useCallback((mm: number) => mm * (dpi / 25.4), [dpi]);

  // 计算页面可用内容高度
  const availableContentHeight = useMemo(() => {
    const topMargin = mmToPx(page.margins.top);
    const bottomMargin = mmToPx(page.margins.bottom);
    const headerHeight = headerFooter.enabled ? topMargin : 0;
    const footerHeight = headerFooter.enabled ? bottomMargin : 0;
    return pageDimensions.height - topMargin - bottomMargin - headerHeight - footerHeight;
  }, [pageDimensions.height, page.margins, mmToPx, headerFooter.enabled]);

  // 章节分割
  const sections = useMemo(() => {
    return splitMarkdownByH2(markdown);
  }, [markdown]);

  // 生成章节HTML列表
  const sectionHtmlList = useMemo(() => {
    const currentTheme = extensions.codeTheme || 'github';
    const themeCss = `${getHljsBaseStyles()}${getHljsTheme(currentTheme)}`;

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

        let result = md.render(section.content);

        if (extensions.githubAlerts) {
          result = result.replace(/:::(\w+)([\s\S]*?):::/g, (_, type, content) => {
            const icons: Record<string, string> = {
              note: 'ℹ️', tip: '💡', important: '⭐', warning: '⚠️', danger: '🚨',
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

  // 核心分页算法
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

    // 对每个章节进行分页
    for (let sectionIndex = 0; sectionIndex < sectionHtmlList.length; sectionIndex++) {
      const section = sectionHtmlList[sectionIndex];
      
      // 创建临时容器测量内容高度
      const tempDiv = document.createElement('div');
      tempDiv.className = 'preview-markdown';
      tempDiv.style.cssText = `
        position: absolute;
        visibility: hidden;
        width: ${pageDimensions.width - mmToPx(page.margins.left) - mmToPx(page.margins.right)}px;
        font-size: ${font.baseSize}px;
        line-height: ${font.lineHeight};
        font-family: ${font.body};
        padding: ${mmToPx(page.margins.top)}px ${mmToPx(page.margins.right)}px ${mmToPx(page.margins.bottom)}px ${mmToPx(page.margins.left)}px;
        box-sizing: border-box;
      `;
      tempDiv.innerHTML = section.html;
      // [TODO: 问题1] 内存泄漏风险：如果后续代码抛异常，removeChild 不会执行
      // 修复：使用 try-finally 确保清理
      document.body.appendChild(tempDiv);

      // 等待渲染
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const totalHeight = tempDiv.offsetHeight;
      // [TODO] 问题1：需要 wrap 在 try-finally 中确保清理
      document.body.removeChild(tempDiv);

      // 计算需要的页数
      const neededPages = Math.max(1, Math.ceil(totalHeight / availableContentHeight));

      // 将内容分成多个页面
      for (let page = 0; page < neededPages; page++) {
        result.push({
          id: `section-${sectionIndex}-page-${page}`,
          pageNumber: pageNumber,
          contentList: [section],
          isCover: false,
          sectionIndex,
          pageIndex: page,
          totalPages: neededPages,
        });
        pageNumber++;
      }
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
                  <div className="a4-page cover-page">
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
                  <div className="a4-page content-page">
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
