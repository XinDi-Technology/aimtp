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
  const { markdown, font, extensions, page, locale } = useAppStore();
  const contentRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = React.useState<number>(100); // 缩放比例，默认 100%
  
  // 缩放选项
  const zoomOptions = [75, 100, 125, 150];
  
  // 处理缩放
  const handleZoom = (value: number) => {
    setZoom(value);
  };
  
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
          {zoomOptions.map((value) => (
            <button
              key={value}
              className={`zoom-btn ${zoom === value ? 'active' : ''}`}
              onClick={() => handleZoom(value)}
              title={`${value}%`}
              aria-label={`${value}% zoom`}
            >
              {value}%
            </button>
          ))}
        </div>
      </div>
      <div className="preview-with-margins">
        {isA4 && (
          <div className="ruler-container">
            <div className="ruler ruler-horizontal">
              <span className="ruler-label">{width}</span>
            </div>
          </div>
        )}
        
        <div className="page-container">
          <div className="margin-ruler margin-ruler-top">
            <span className="margin-ruler-label">{page.margins.top}mm</span>
          </div>
          
          <div className="page-middle">
            <div className="margin-ruler margin-ruler-left">
              <span className="margin-ruler-label">{page.margins.left}mm</span>
            </div>
            
            <div className="content-area" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
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
            </div>
            
            <div className="margin-ruler margin-ruler-right">
              <span className="margin-ruler-label">{page.margins.right}mm</span>
            </div>
          </div>
          
          <div className="margin-ruler margin-ruler-bottom">
            <span className="margin-ruler-label">{page.margins.bottom}mm</span>
          </div>
        </div>
        
        {/* 页码显示 */}
        <div className="page-number">
          <span>第 1 页 / 共 1 页</span>
        </div>
      </div>
    </div>
  );
});

PreviewPanel.displayName = 'PreviewPanel';
