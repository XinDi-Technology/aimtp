import { resetMarkdownIt } from './markdown';
import { FontSettings, PageSettings, ExtensionSettings, HeaderFooterSettings, CoverSettings } from '../store/useAppStore';
import { logger } from './logger';
import DOMPurify from 'dompurify';
import { getHljsTheme, getHljsBaseStyles } from './hljsThemes';

export interface HtmlGeneratorOptions {
  markdown: string;
  locale: 'zh' | 'en';
  page: PageSettings;
  font: FontSettings;
  extensions: ExtensionSettings;
  headerFooter: HeaderFooterSettings;
  cover: CoverSettings;
}

export const generateHtml = (options: HtmlGeneratorOptions): string => {
  const { markdown, locale, page, font, extensions, headerFooter, cover } = options;
  
  try {
    // TODO: 待功能完善后考虑缓存相同配置的 MarkdownIt 实例，避免每次重新创建
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
    });
    
    let content = md.render(markdown);
    
    if (extensions.githubAlerts) {
      content = content.replace(/:::(\w+)([\s\S]*?):::/g, (_, type, alertContent) => {
        const alertStyles: Record<string, { bg: string; border: string }> = {
          note: { bg: '#f0f6fc', border: '#d0deec' },
          tip: { bg: '#dafbe1', border: '#a8e6b1' },
          important: { bg: '#fff8c5', border: '#e3d593' },
          warning: { bg: '#fff8c5', border: '#e3d593' },
          danger: { bg: '#ffebe9', border: '#ffc1aa' },
        };
        const style = alertStyles[type] || alertStyles.note;
        const icons: Record<string, string> = {
          note: 'ℹ️',
          tip: '💡',
          important: '⭐',
          warning: '⚠️',
          danger: '🚨',
        };
        return `<div class="github-alert" style="background: ${style.bg}; border: 1px solid ${style.border}; border-radius: 6px; padding: 12px; margin: 12px 0; display: flex; gap: 12px;">
          <span class="alert-icon">${icons[type] || 'ℹ️'}</span>
          <div class="alert-content">${alertContent.trim()}</div>
        </div>`;
      });
    }
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sanitized = DOMPurify.sanitize(content, {
        ADD_ATTR: ['target', 'id', 'data-processed'],
        ALLOW_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'strong', 'em', 'br', 'hr', 'div', 'span', 'img', 'svg', 'path', 'g', 'rect', 'circle', 'text', 'tspan', 'line', 'polyline', 'polygon'],
        ALLOW_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'target', 'id', 'data-processed', 'd', 'fill', 'stroke', 'stroke-width', 'transform', 'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'viewBox', 'preserveAspectRatio', 'xmlns', 'font-family', 'font-size', 'text-anchor', 'dominant-baseline', 'marker-end', 'marker-start'],
      } as any);
      content = sanitized as string;
    } catch (e) {
      logger.warn('DOMPurify sanitization failed:', e);
    }

    const isPortrait = page.orientation === 'portrait';
    const maxWidth = page.size === 'A4' 
      ? (isPortrait ? '210mm' : '297mm')
      : page.size === 'A3'
      ? (isPortrait ? '297mm' : '420mm')
      : '100%';

    // 获取 highlight.js 主题样式（本地化，无 CDN 依赖）
    const hljsTheme = extensions.codeTheme || 'github';
    const hljsStyles = extensions.codeHighlight 
      ? `<style>${getHljsBaseStyles()}${getHljsTheme(hljsTheme)}</style>` 
      : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${hljsStyles}
  ${extensions.mermaid ? `<script>
    // Mermaid is loaded from local node_modules
  </script>` : ''}
  ${extensions.mathJax ? `<script>
    // MathJax is loaded from local node_modules
    window.MathJax = {
      tex: { inlineMath: [["$", "$"], ["\\(", "\\)"]], displayMath: [["$$", "$$"], ["\\[", "\\]"]] },
      svg: { fontCache: 'global' },
      startup: { ready: () => MathJax.startup.defaultReady() }
    };
  </script>` : ''}
  <style>
    body {
      font-family: ${font.body}, sans-serif;
      font-size: ${font.baseSize}px;
      line-height: ${font.lineHeight};
      max-width: ${maxWidth};
      margin: 0 auto;
      padding: ${page.margins.top}mm ${page.margins.right}mm ${page.margins.bottom}mm ${page.margins.left}mm;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: ${font.heading}, sans-serif;
    }
    pre, code {
      font-family: ${font.code}, monospace;
    }
    pre {
      background: #1a1a1a;
      color: #f5f5f5;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
    }
    code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 4px;
    }
    pre code {
      background: transparent;
      padding: 0;
    }
    blockquote {
      border-left: 3px solid #d4462a;
      padding-left: 16px;
      margin: 16px 0;
      color: #5c5c5c;
      font-style: italic;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    th, td {
      border: 1px solid #e5e3dd;
      padding: 8px 16px;
      text-align: left;
    }
    th {
      background: #f5f4f0;
      font-weight: 600;
    }
    .github-alert {
      border-radius: 6px;
      padding: 12px;
      margin: 12px 0;
      display: flex;
      gap: 12px;
    }
    .task-list-item {
      list-style-type: none;
    }
    .task-list-item-checkbox {
      margin-right: 8px;
    }
    .footnote-ref {
      vertical-align: super;
      font-size: 0.8em;
    }
    .footnotes {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e5e3dd;
    }
    .footnote-item {
      margin-bottom: 8px;
    }
    .footnote-backref {
      margin-left: 4px;
    }
    .cover-page {
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      text-align: center;
      padding: 40px;
    }
    .cover-title {
      font-size: 48px;
      font-weight: bold;
      margin-bottom: 20px;
      font-family: ${font.heading}, sans-serif;
    }
    .cover-author {
      font-size: 24px;
      margin-bottom: 20px;
      font-family: ${font.body}, sans-serif;
    }
    .cover-date {
      font-size: 18px;
      color: #666;
      font-family: ${font.body}, sans-serif;
    }
    /* Mermaid 图表样式 */
    .mermaid {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 1.5em 0;
      padding: 1em;
      background: transparent;
      overflow-x: auto;
    }
    .mermaid svg {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
    }
    .mermaid-error {
      color: #d4462a;
      font-size: 0.9em;
      background: #fff8f8;
      padding: 12px 16px;
      border-radius: 6px;
      border: 1px solid #ffc1aa;
      margin: 1em 0;
    }
    /* MathJax 样式 */
    .math-display {
      margin: 1em 0;
      padding: 0.5em 0;
      overflow-x: auto;
      overflow-y: hidden;
    }
    .math-display svg {
      display: block;
      margin: 0 auto;
      max-width: 100%;
      height: auto;
    }
    .math-inline svg {
      display: inline-block;
      vertical-align: middle;
    }
    ${headerFooter.enabled ? `
    @page {
      margin: ${page.margins.top}mm ${page.margins.right}mm ${page.margins.bottom}mm ${page.margins.left}mm;
      @top-center {
        content: "${headerFooter.header.content.replace(/"/g, '\\"').replace(/\n/g, ' ')}";
        font-family: ${headerFooter.header.font};
        text-align: ${headerFooter.header.alignment};
        font-size: ${font.baseSize * 0.9}px;
      }
      @bottom-center {
        content: ${headerFooter.footer.content === 'pageNumber' ? 'counter(page)' : headerFooter.footer.content === 'pageNumberTotal' ? '"第" counter(page) "页/共" counter(pages) "页"' : `"${headerFooter.footer.content.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`};
        font-family: ${headerFooter.footer.font};
        text-align: ${headerFooter.footer.alignment};
        font-size: ${font.baseSize * 0.9}px;
      }
    }
    body {
      counter-reset: page;
    }
    ` : ''}
  </style>
</head>
<body>
  ${cover.enabled ? `
    <div class="cover-page">
      ${cover.title ? `<div class="cover-title">${DOMPurify.sanitize(cover.title)}</div>` : ''}
      ${cover.author ? `<div class="cover-author">${DOMPurify.sanitize(cover.author)}</div>` : ''}
      ${cover.date ? `<div class="cover-date">${new Date().toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>` : ''}
    </div>
  ` : ''}
  ${content}
  ${extensions.mermaid ? `
  <script>
    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        flowchart: { curve: 'basis', htmlLabels: true, useMaxWidth: true },
        sequence: { showSequenceNumbers: true }
      });
      document.addEventListener('DOMContentLoaded', function() {
        mermaid.run({ querySelector: '.mermaid', suppressErrors: true });
      });
    }
  </script>` : ''}
  ${extensions.mathJax ? `
  <script>
    if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
      MathJax.startup.promise.then(function() {
        return MathJax.typesetPromise(document.body);
      }).catch(function(err) {
        console.warn('MathJax typeset error:', err);
      });
    }
  </script>` : ''}
</body>
</html>`.trim();
  } catch (error) {
    logger.error('HTML generation error:', error);
    return `<html><body><h1>Error generating HTML</h1><p>${(error as Error).message}</p></body></html>`;
  }
};
