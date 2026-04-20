import React, { useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { resetMarkdownIt } from '../utils/markdown';
import { renderMermaid } from '../utils/mermaidPlugin';
import { typesetMath } from '../utils/mathjaxPlugin';
import { getHljsTheme, getHljsBaseStyles } from '../utils/hljsThemes';
import { splitMarkdownByH2, PageSection } from '../utils/pageSplitter';
import { parseFrontMatter, formatDate } from '../utils/frontMatter';
import { t } from '../../shared/i18n';
import './PreviewPanel.css';

interface PreviewPanelProps {
  className?: string;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = React.memo(({ className }) => {
  const { markdown, font, extensions, page, locale, cover, headerFooter } = useAppStore();
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]); // 多个页面的引用
  const containerRef = useRef<HTMLDivElement>(null); // 容器引用
  const [zoomMode, setZoomMode] = React.useState<'fit-width' | 'fit-height' | 'actual'>('fit-width'); // 缩放模式
  const [actualZoom, setActualZoom] = React.useState<number>(100); // 实际缩放比例
  
  // 从 Front Matter 提取封面元数据
  const frontMatterData = useMemo(() => {
    const { data } = parseFrontMatter(markdown);
    return data;
  }, [markdown]);
  
  // 封面标题：优先使用 Front Matter 的 title，其次 H1，最后默认文本
  const coverTitle = useMemo(() => {
    if (frontMatterData.title) {
      return String(frontMatterData.title);
    }
    // 尝试从 Markdown 中提取第一个 H1 标题
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
  
  // 获取页眉内容（从 Front Matter 提取）
  const getHeaderContent = useMemo(() => {
    if (!headerFooter.enabled || !headerFooter.header.content) return '';
    
    switch (headerFooter.header.content) {
      case 'title':
        return coverTitle;
      case 'author':
        return coverAuthor;
      case 'date':
        return coverDate;
      default:
        return '';
    }
  }, [headerFooter.enabled, headerFooter.header.content, coverTitle, coverAuthor, coverDate]);
  
  // 获取页脚内容（从 Front Matter 提取或页码）
  const getFooterContent = useMemo(() => {
    if (!headerFooter.enabled) return '';
    
    const content = headerFooter.footer.content;
    if (content === 'pageNumber' || content === 'pageNumberTotal') {
      return content; // 返回特殊标记，稍后处理
    }
    
    switch (content) {
      case 'title':
        return coverTitle;
      case 'author':
        return coverAuthor;
      case 'date':
        return coverDate;
      default:
        return '';
    }
  }, [headerFooter.enabled, headerFooter.footer.content, coverTitle, coverAuthor, coverDate]);
  
  // A4 纸张尺寸（毫米）
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  
  // 根据设置动态计算页面尺寸
  const getPageDimensions = () => {
    const isPortrait = page.orientation === 'portrait';
    
    if (page.size === 'A3') {
      return {
        width: isPortrait ? 297 : 420,
        height: isPortrait ? 420 : 297,
      };
    }
    
    // 默认 A4
    return {
      width: isPortrait ? 210 : 297,
      height: isPortrait ? 297 : 210,
    };
  };
  
  const pageDimensions = getPageDimensions();
  
  // TODO: [P1] 计算页数（基于 H2 标题分割）
  const pages = useMemo(() => {
    return splitMarkdownByH2(markdown);
  }, [markdown]);
  
  const totalPages = Math.max(1, pages.length);
  
  // 组件挂载后，确保滚动到顶部
  useEffect(() => {
    if (containerRef.current) {
      // 延迟一小段时间，确保内容已渲染
      setTimeout(() => {
        containerRef.current?.scrollTo(0, 0);
      }, 100);
    }
  }, [markdown, cover.enabled, pages.length]);
  
  // 处理缩放模式切换
  const handleZoomModeChange = (mode: 'fit-width' | 'fit-height' | 'actual') => {
    setZoomMode(mode);
  };
  
  // 监听窗口大小变化，自动调整缩放比例
  React.useEffect(() => {
    const calculateZoom = () => {
      if (!containerRef.current) return;
      
      // 关键修复：使用 clientWidth/clientHeight 而不是 offsetWidth/offsetHeight
      // clientWidth/clientHeight 不包含 padding，更准确地反映可用空间
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      
      // 页面实际像素尺寸（96 DPI）
      const pageWidthPx = pageDimensions.width * (96 / 25.4);
      const pageHeightPx = pageDimensions.height * (96 / 25.4);
      
      let newZoom = 100;
      
      if (zoomMode === 'fit-width') {
        // 适应宽度：留出 80px 的边距（左右各 40px）
        const availableWidth = containerWidth - 80;
        newZoom = (availableWidth / pageWidthPx) * 100;
        // 限制在 50% - 150% 之间
        newZoom = Math.max(50, Math.min(150, newZoom));
      } else if (zoomMode === 'fit-height') {
        // 适应高度：留出 120px 的空间（头部 + 底部边距）
        const availableHeight = containerHeight - 120;
        newZoom = (availableHeight / pageHeightPx) * 100;
        // 限制在 50% - 150% 之间
        newZoom = Math.max(50, Math.min(150, newZoom));
      } else {
        // 实际大小
        newZoom = 100;
      }
      
      setActualZoom(Math.round(newZoom));
    };
    
    // 初始计算
    calculateZoom();
    
    // 监听窗口大小变化
    window.addEventListener('resize', calculateZoom);
    
    // 使用 ResizeObserver 监听容器大小变化
    const observer = new ResizeObserver(calculateZoom);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', calculateZoom);
      observer.disconnect();
    };
  }, [zoomMode, pageDimensions]);
  
  // 渲染 Mermaid 图表和 MathJax 公式
  useEffect(() => {
    let hasChanges = false;
    
    // 遍历所有页面内容进行渲染
    contentRefs.current.forEach(async (contentRef, pageIndex) => {
      if (!contentRef) return;

      // 渲染 Mermaid 图表（如果启用）
      if (extensions.mermaid) {
        try {
          await renderMermaid(contentRef, { suppressErrors: true, resetMmdId: true });
          hasChanges = true;
        } catch (error) {
          console.error(`Mermaid rendering error on page ${pageIndex + 1}:`, error);
        }
      }

      // 渲染 MathJax 公式（如果启用）
      if (extensions.mathJax) {
        try {
          await typesetMath(contentRef);
          hasChanges = true;
        } catch (error) {
          console.error(`MathJax rendering error on page ${pageIndex + 1}:`, error);
        }
      }
    });
    
    // 如果内容有变化，延迟重新计算缩放比例
    if (hasChanges) {
      setTimeout(() => {
        // 触发窗口 resize 事件，重新计算缩放
        window.dispatchEvent(new Event('resize'));
      }, 300); // 等待渲染完成
    }
  }, [markdown, extensions, pages.length]);
  
  // 为每个页面生成 HTML 和样式
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
  
  const previewStyle: React.CSSProperties = useMemo(() => {
    const isPortrait = page.orientation === 'portrait';
    let maxWidth = '100%';
    
    if (page.size === 'A4') {
      maxWidth = isPortrait ? '210mm' : '297mm';
    } else if (page.size === 'A3') {
      maxWidth = isPortrait ? '297mm' : '420mm';
    }
    
    return {
      fontSize: `${font.baseSize}px`,
      lineHeight: font.lineHeight,
      maxWidth: maxWidth,
      margin: '0 auto',
    };
  }, [font.baseSize, font.lineHeight, font.body, font.heading, font.code, page.size, page.orientation, page.margins]);
  
  // 生成动态标题样式（基于 headingScale）
  const headingStyles = useMemo(() => {
    const scale = font.headingScale || 1.2; // 默认值 1.2
    return `
      .markdown-preview h1 { font-size: ${font.baseSize * Math.pow(scale, 5)}px !important; }
      .markdown-preview h2 { font-size: ${font.baseSize * Math.pow(scale, 4)}px !important; }
      .markdown-preview h3 { font-size: ${font.baseSize * Math.pow(scale, 3)}px !important; }
      .markdown-preview h4 { font-size: ${font.baseSize * Math.pow(scale, 2)}px !important; }
      .markdown-preview h5 { font-size: ${font.baseSize * Math.pow(scale, 1)}px !important; }
      .markdown-preview h6 { font-size: ${font.baseSize * Math.pow(scale, 0)}px !important; }
    `;
  }, [font.baseSize, font.headingScale]);
  
  const isA4 = page.size === 'A4';
  const isPortrait = page.orientation === 'portrait';
  const width = isPortrait ? '210mm' : '297mm';
  const height = isPortrait ? '297mm' : '210mm';

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
      
      {/* 根据 zoomMode 计算 actualZoom */}
      
      <div className="preview-with-margins" ref={containerRef}>
        {/* 在容器级别应用缩放，而不是每个页面 */}
        <div 
          className="page-container"
          style={{
            transform: `scale(${actualZoom / 100})`,
            transformOrigin: 'top center',
          }}
        >
          {/* 如果启用封面，显示封面页 */}
          {cover.enabled && (
            <div 
              className="a4-page cover-page"
              style={{
                width: `${pageDimensions.width}mm`,
                height: `${pageDimensions.height}mm`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div className="cover-content" style={{ textAlign: 'center' }}>
                <h1 style={{ 
                  fontSize: `${font.baseSize * 2.5}px`, // 使用基础字号的 2.5 倍
                  marginBottom: '20px',
                  fontFamily: font.heading,
                }}>
                  {coverTitle}
                </h1>
                {coverAuthor && (
                  <p className="cover-author" style={{ 
                    fontSize: `${font.baseSize * 1.5}px`, // 使用基础字号的 1.5 倍
                    color: '#666',
                    marginBottom: '10px',
                    fontFamily: font.body,
                  }}>
                    {coverAuthor}
                  </p>
                )}
                {coverDate && (
                  <p className="cover-date" style={{ 
                    fontSize: `${font.baseSize * 1.2}px`, // 使用基础字号的 1.2 倍
                    color: '#999',
                    fontFamily: font.body,
                  }}>
                    {coverDate}
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* 内容区域 - 连续显示，用分页标记分隔 */}
          <div 
            className="a4-page content-pages"
            style={{
              width: `${pageDimensions.width}mm`,
              // 关键修复：使用 auto 而不是固定高度，允许内容自然展开
              minHeight: 'auto',
              height: 'auto',
              position: 'relative',
            }}
          >
            {/* 渲染所有页面内容，连续显示 */}
            {pages.map((pageSection, pageIndex) => {
              // 计算当前页码（考虑封面）
              const currentPageNumber = pageIndex + (cover.enabled ? 2 : 1);
              const totalPagesCount = pages.length + (cover.enabled ? 1 : 0);
              
              // 生成页眉 HTML
              const renderHeader = () => {
                if (!headerFooter.enabled || !headerFooter.header.content) return null;
                
                let headerText = '';
                switch (headerFooter.header.content) {
                  case 'title':
                    headerText = coverTitle;
                    break;
                  case 'author':
                    headerText = coverAuthor;
                    break;
                  case 'date':
                    headerText = coverDate;
                    break;
                  default:
                    return null;
                }
                
                return (
                  <div
                    style={{
                      position: 'absolute',
                      top: `${page.margins.top / 2}mm`,
                      left: page.margins.left + 'mm',
                      right: page.margins.right + 'mm',
                      textAlign: headerFooter.header.alignment,
                      fontFamily: headerFooter.header.font,
                      fontSize: `${font.baseSize * 0.9}px`,
                      color: '#666',
                      pointerEvents: 'none',
                    }}
                  >
                    {headerText}
                  </div>
                );
              };
              
              // 生成页脚 HTML
              const renderFooter = () => {
                if (!headerFooter.enabled || !headerFooter.footer.content) return null;
                
                let footerText = '';
                const content = headerFooter.footer.content;
                
                if (content === 'pageNumber') {
                  footerText = String(currentPageNumber);
                } else if (content === 'pageNumberTotal') {
                  footerText = `第 ${currentPageNumber} 页 / 共 ${totalPagesCount} 页`;
                } else {
                  switch (content) {
                    case 'title':
                      footerText = coverTitle;
                      break;
                    case 'author':
                      footerText = coverAuthor;
                      break;
                    case 'date':
                      footerText = coverDate;
                      break;
                    default:
                      return null;
                  }
                }
                
                return (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: `${page.margins.bottom / 2}mm`,
                      left: page.margins.left + 'mm',
                      right: page.margins.right + 'mm',
                      textAlign: headerFooter.footer.alignment,
                      fontFamily: headerFooter.footer.font,
                      fontSize: `${font.baseSize * 0.9}px`,
                      color: '#666',
                      pointerEvents: 'none',
                    }}
                  >
                    {footerText}
                  </div>
                );
              };
              
              return (
                <div key={pageIndex} className="page-section" style={{ position: 'relative' }}>
                  {/* 如果不是第一个章节，添加分页标记 */}
                  {pageIndex > 0 && (
                    <div className="page-break-marker">
                      <span className="marker-line"></span>
                      <span className="marker-text">
                        {locale === 'zh' ? `第 ${currentPageNumber} 页` : `Page ${currentPageNumber}`}
                      </span>
                      <span className="marker-line"></span>
                    </div>
                  )}
                  
                  {/* 页眉 */}
                  {renderHeader()}
                  
                  {/* 章节内容 */}
                  <div 
                    ref={(el) => {
                      contentRefs.current[pageIndex] = el;
                    }}
                    className="markdown-preview"
                    style={{
                      ...previewStyle,
                      padding: `${page.margins.top}mm ${page.margins.right}mm ${page.margins.bottom}mm ${page.margins.left}mm`,
                      fontFamily: font.body,
                    }}
                  >
                    <style key={`hljs-theme-${extensions.codeTheme}`}>
                      {`.markdown-preview h1, .markdown-preview h2, .markdown-preview h3, 
                      .markdown-preview h4, .markdown-preview h5, .markdown-preview h6 {
                        font-family: ${font.heading} !important;
                      }
                      .markdown-preview pre, .markdown-preview code {
                        font-family: ${font.code}, monospace !important;
                        font-size: inherit !important; /* 继承父元素的 font-size */
                      }
                      /* 代码高亮主题样式 */
                      ${pageHtmlList[pageIndex]?.themeCss || ''}
                      /* 动态标题大小（基于 headingScale） */
                      ${headingStyles}`}
                    </style>
                    <div dangerouslySetInnerHTML={{ __html: pageHtmlList[pageIndex]?.html || '' }} />
                  </div>
                  
                  {/* 页脚 */}
                  {renderFooter()}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

PreviewPanel.displayName = 'PreviewPanel';
