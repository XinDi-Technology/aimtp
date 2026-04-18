import React, { useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { resetMarkdownIt } from '../utils/markdown';
import { renderMermaid } from '../utils/mermaidPlugin';
import { typesetMath } from '../utils/mathjaxPlugin';
import { getHljsTheme, getHljsBaseStyles } from '../utils/hljsThemes';
import { t } from '../../shared/i18n';
import './PreviewPanel.css';

interface PreviewPanelProps {
  className?: string;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = React.memo(({ className }) => {
  const { markdown, font, extensions, page, locale, cover, headerFooter } = useAppStore();
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // 容器引用
  const [zoomMode, setZoomMode] = React.useState<'fit-width' | 'fit-height' | 'actual'>('fit-width'); // 缩放模式
  const [actualZoom, setActualZoom] = React.useState<number>(100); // 实际缩放比例
  
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
  
  // TODO: [P1] 计算页数（基于内容高度）
  // 实现思路：
  // 1. 获取 contentRef.current.scrollHeight - 内容总高度
  // 2. 计算每页可用高度 = (A4_HEIGHT_MM - margins.top - margins.bottom) * (96/25.4)
  // 3. totalPages = Math.ceil(contentHeight / availableHeight)
  // 4. 需要考虑：图片、代码块、表格等元素不能被截断
  // const totalPages = useMemo(() => {
  //   if (!contentRef.current) return 1;
  //   const contentHeight = contentRef.current.scrollHeight;
  //   const marginsTotal = page.margins.top + page.margins.bottom;
  //   const availableHeightMm = (page.orientation === 'portrait' ? A4_HEIGHT_MM : A4_WIDTH_MM) - marginsTotal;
  //   const availableHeightPx = availableHeightMm * (96 / 25.4);
  //   return Math.max(1, Math.ceil(contentHeight / availableHeightPx));
  // }, [markdown, page]);
  const totalPages = 1; // 临时值
  
  // 处理缩放模式切换
  const handleZoomModeChange = (mode: 'fit-width' | 'fit-height' | 'actual') => {
    setZoomMode(mode);
  };
  
  // 监听窗口大小变化，自动调整缩放比例
  React.useEffect(() => {
    const calculateZoom = () => {
      if (!containerRef.current) return;
      
      const containerWidth = containerRef.current.offsetWidth;
      const containerHeight = containerRef.current.offsetHeight;
      
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
    if (!contentRef.current) return;

    const renderContent = async () => {
      // 渲染 Mermaid 图表（如果启用）
      if (extensions.mermaid) {
        try {
          await renderMermaid(contentRef.current!, { suppressErrors: true, resetMmdId: true });
        } catch (error) {
          console.error('Mermaid rendering error:', error);
        }
      }

      // 渲染 MathJax 公式（如果启用）
      if (extensions.mathJax) {
        try {
          await typesetMath(contentRef.current!);
        } catch (error) {
          console.error('MathJax rendering error:', error);
        }
      }
    };

    renderContent();
  }, [markdown, extensions]);
  
  // 注入 Highlight.js 主题样式
  useEffect(() => {
    const currentTheme = extensions.codeTheme || 'github';
    const themeCss = `${getHljsBaseStyles()}${getHljsTheme(currentTheme)}`;
    
    let styleTag = document.getElementById('hljs-theme-style') as HTMLStyleElement;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'hljs-theme-style';
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = themeCss;
  }, [extensions.codeTheme]);
  
  const html = useMemo(() => {
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
      
      let result = md.render(markdown);
      
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
      
      return result;
    } catch (error) {
      console.error('Preview markdown parsing error:', error);
      return `<div class="error-message">Error parsing markdown: ${(error as Error).message}</div>`;
    }
  }, [markdown, extensions]);
  
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
        <div className="page-container">
          {/* 如果启用封面，显示封面页 */}
          {cover.enabled && (
            <div 
              className="a4-page cover-page"
              style={{
                width: `${pageDimensions.width}mm`,
                minHeight: `${pageDimensions.height}mm`,
                transform: `scale(${actualZoom / 100})`,
                transformOrigin: 'top center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div className="cover-content" style={{ textAlign: 'center' }}>
                <h1 style={{ 
                  fontSize: '32px', 
                  marginBottom: '20px',
                  fontFamily: font.heading,
                }}>
                  {cover.title || '文档标题'}
                </h1>
                <p className="cover-author" style={{ 
                  fontSize: '18px',
                  color: '#666',
                  marginBottom: '10px',
                  fontFamily: font.body,
                }}>
                  {cover.author || '作者'}
                </p>
                {cover.date && (
                  <p className="cover-date" style={{ 
                    fontSize: '14px',
                    color: '#999',
                    fontFamily: font.body,
                  }}>
                    {new Date().toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US')}
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* A4 页面 - Word 风格 */}
          <div 
            className="a4-page"
            style={{
              width: `${pageDimensions.width}mm`,
              minHeight: `${pageDimensions.height}mm`,
              transform: `scale(${actualZoom / 100})`,
              transformOrigin: 'top center',
            }}
          >
            {/* 如果启用页眉，显示页眉 */}
            {headerFooter.enabled && headerFooter.header.content && (
              <div 
                className="page-header"
                style={{
                  position: 'absolute',
                  top: '10mm',
                  left: `${page.margins.left}mm`,
                  right: `${page.margins.right}mm`,
                  textAlign: headerFooter.header.alignment,
                  fontFamily: headerFooter.header.font,
                  fontSize: '12px',
                  color: '#666',
                  borderBottom: '1px solid #e0e0e0',
                  paddingBottom: '5mm',
                }}
              >
                {headerFooter.header.content}
              </div>
            )}
            
            <div 
              ref={contentRef}
              className="markdown-preview"
              style={{
                ...previewStyle,
                padding: `${page.margins.top}mm ${page.margins.right}mm ${page.margins.bottom}mm ${page.margins.left}mm`,
                fontFamily: font.body,
              }}
            >
              <style>{`
                .markdown-preview h1, .markdown-preview h2, .markdown-preview h3, 
                .markdown-preview h4, .markdown-preview h5, .markdown-preview h6 {
                  font-family: ${font.heading} !important;
                }
                .markdown-preview pre, .markdown-preview code {
                  font-family: ${font.code} !important;
                }
              `}</style>
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </div>
            
            {/* 如果启用页脚，显示页脚 */}
            {headerFooter.enabled && (
              <div 
                className="page-footer-custom"
                style={{
                  position: 'absolute',
                  bottom: '10mm',
                  left: `${page.margins.left}mm`,
                  right: `${page.margins.right}mm`,
                  textAlign: headerFooter.footer.alignment,
                  fontFamily: headerFooter.footer.font,
                  fontSize: '12px',
                  color: '#666',
                  borderTop: '1px solid #e0e0e0',
                  paddingTop: '5mm',
                }}
              >
                {headerFooter.footer.content === 'pageNumber' ? '1' :
                 headerFooter.footer.content === 'pageNumberTotal' ? `1 / ${totalPages}` :
                 headerFooter.footer.content}
              </div>
            )}
            
            {/* 临时页码显示（未启用页眉页脚时） */}
            {!headerFooter.enabled && (
              <div className="page-footer">
                <span>{locale === 'zh' ? `第 1 页 / 共 ${totalPages} 页` : `Page 1 of ${totalPages}`}</span>
              </div>
            )}
          </div>
          
          {/* TODO: [P1] 如果有多个页面，显示分页 */}
          {/* 实现思路：
              1. 根据 totalPages 渲染多个 .a4-page
              2. 每个页面只显示对应部分的内容（需要分割 HTML）
              3. 或者使用 CSS columns 自动分页
              4. 在页面之间显示分隔线
          */}
          {/* {pages.length > 1 && pages.map((pageContent, index) => (
            <React.Fragment key={index}>
              <div className="page-break-indicator">--- 第 {index + 1} 页 ---</div>
              <div className="a4-page">
                <div dangerouslySetInnerHTML={{ __html: pageContent }} />
              </div>
            </React.Fragment>
          ))} */}
          
          {/* TODO: [P2] 检测并警告可能被截断的元素 */}
          {/* 实现思路：
              1. 遍历所有大块元素（h1-h6, pre, table, img, blockquote）
              2. 检查元素是否跨越分页位置
              3. 如果会截断，添加警告标记或调整布局
              4. 可以使用 CSS break-inside: avoid 防止截断
          */}
        </div>
      </div>
    </div>
  );
});

PreviewPanel.displayName = 'PreviewPanel';
