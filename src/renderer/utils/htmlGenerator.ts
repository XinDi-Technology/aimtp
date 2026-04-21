import { resetMarkdownIt } from './markdown';
import { FontSettings, PageSettings, ExtensionSettings, HeaderFooterSettings, CoverSettings } from '../store/useAppStore';
import { logger } from './logger';
import DOMPurify from 'dompurify';
import { getHljsTheme, getHljsBaseStyles } from './hljsThemes';
import { parseFrontMatter, formatDate } from './frontMatter';
import { renderMermaidSync } from './mermaidPlugin';
import { renderMathInlineAsync, renderMathDisplayAsync } from './mathjaxPlugin';

export interface HtmlGeneratorOptions {
  markdown: string;
  locale: 'zh' | 'en';
  page: PageSettings;
  font: FontSettings;
  extensions: ExtensionSettings;
  headerFooter: HeaderFooterSettings;
  cover: CoverSettings;
}

export const generateHtml = async (options: HtmlGeneratorOptions): Promise<string> => {
  const { markdown, locale, page, font, extensions, headerFooter, cover } = options;
  
  try {
    // 从 Front Matter 提取元数据
    const { data: frontMatter } = parseFrontMatter(markdown);
    
    // 获取页眉内容
    const getHeaderContent = () => {
      if (!headerFooter.header.content) return '';
      switch (headerFooter.header.content) {
        case 'title':
          return String(frontMatter.title || '');
        case 'author':
          return String(frontMatter.author || '');
        case 'date':
          return formatDate(frontMatter.date, locale);
        default:
          return '';
      }
    };
    
    // 获取页脚内容
    const getFooterContent = () => {
      const content = headerFooter.footer.content;
      if (content === 'pageNumber' || content === 'pageNumberTotal') {
        return content; // 返回特殊标记
      }
      switch (content) {
        case 'title':
          return String(frontMatter.title || '');
        case 'author':
          return String(frontMatter.author || '');
        case 'date':
          return formatDate(frontMatter.date, locale);
        default:
          return '';
      }
    };
    
    const headerContent = getHeaderContent();
    const footerContent = getFooterContent();
  
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
        const icons: Record<string, string> = {
          note: 'ℹ️',
          tip: '💡',
          important: '⭐',
          warning: '⚠️',
          danger: '🚨',
        };
        return `<div class="github-alert ${type}">
          <span class="alert-icon">${icons[type] || 'ℹ️'}</span>
          <div class="alert-content">${alertContent.trim()}</div>
        </div>`;
      });
    }
    
    // 预渲染 Mermaid 图表
    if (extensions.mermaid) {
      try {
        content = await preRenderMermaid(content);
      } catch (error) {
        logger.error('Mermaid pre-render error:', error);
      }
    }
    
    // 预渲染 MathJax 公式
    if (extensions.mathJax) {
      try {
        content = await preRenderMathJax(content);
      } catch (error) {
        logger.error('MathJax pre-render error:', error);
      }
    }
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sanitized = DOMPurify.sanitize(content, {
        ADD_ATTR: ['target', 'id', 'data-processed'],
        ALLOW_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'strong', 'em', 'br', 'hr', 'div', 'span', 'img', 'svg', 'path', 'g', 'rect', 'circle', 'text', 'tspan', 'line', 'polyline', 'polygon'],
        ALLOW_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'target', 'id', 'data-processed', 'd', 'fill', 'stroke', 'stroke-width', 'transform', 'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'viewBox', 'preserveAspectRatio', 'xmlns', 'font-family', 'font-size', 'text-anchor', 'dominant-baseline', 'marker-end', 'marker-start'],
      } as any);
      content = (sanitized as unknown) as string;
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
    /* 动态标题大小（基于 headingScale） */
    h1 { font-size: ${font.baseSize * Math.pow(font.headingScale || 1.2, 5)}px; }
    h2 { font-size: ${font.baseSize * Math.pow(font.headingScale || 1.2, 4)}px; }
    h3 { font-size: ${font.baseSize * Math.pow(font.headingScale || 1.2, 3)}px; }
    h4 { font-size: ${font.baseSize * Math.pow(font.headingScale || 1.2, 2)}px; }
    h5 { font-size: ${font.baseSize * Math.pow(font.headingScale || 1.2, 1)}px; }
    h6 { font-size: ${font.baseSize * Math.pow(font.headingScale || 1.2, 0)}px; }
    pre, code {
      font-family: ${font.code}, monospace;
      font-size: inherit; /* 继承父元素的 font-size */
    }
    pre {
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
    }
    code {
      padding: 2px 6px;
      border-radius: 4px;
    }
    pre code {
      padding: 0;
    }
    blockquote {
      border-left: 4px solid #c43d24;
      padding-left: 16px;
      margin: 16px 0;
      color: #555;
      font-style: italic;
      background: #fafaf8;
      padding: 12px 16px;
      border-radius: 0 4px 4px 0;
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
      align-items: center;
      justify-content: center;
      height: 100vh;
      text-align: center;
      padding: 0;
    }
    .cover-title {
      font-size: ${font.baseSize * 2.5}px;
      font-weight: bold;
      margin-bottom: 20px;
      font-family: ${font.heading}, sans-serif;
    }
    .cover-author {
      font-size: ${font.baseSize * 1.5}px;
      margin-bottom: 20px;
      font-family: ${font.body}, sans-serif;
    }
    .cover-date {
      font-size: ${font.baseSize * 1.2}px;
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
    /* 封面页（第一页）：不显示页眉页脚 */
    @page :first {
      margin: 0;
    }
    /* 后续页面：显示页眉页脚 */
    @page {
      margin: ${page.margins.top}mm ${page.margins.right}mm ${page.margins.bottom}mm ${page.margins.left}mm;
      
      /* 页眉 - 根据对齐方式选择位置 */
      ${headerFooter.header.alignment === 'left' ? `@top-left` : headerFooter.header.alignment === 'right' ? `@top-right` : `@top-center`} {
        content: "${headerContent.replace(/"/g, '\\"').replace(/\n/g, ' ')}";
        font-family: ${headerFooter.header.font};
        font-size: ${font.baseSize * 0.9}px;
        color: #666;
      }
      
      /* 页脚 - 根据对齐方式选择位置 */
      ${headerFooter.footer.alignment === 'left' ? `@bottom-left` : headerFooter.footer.alignment === 'right' ? `@bottom-right` : `@bottom-center`} {
        content: ${footerContent === 'pageNumber' ? 'counter(page)' : footerContent === 'pageNumberTotal' ? '"\\7B2C" counter(page) "\\9875/\\5171" counter(pages) "\\9875"' : `"${footerContent.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`};
        font-family: ${headerFooter.footer.font};
        font-size: ${font.baseSize * 0.9}px;
        color: #666;
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
      ${(() => {
        // 从 Front Matter 提取封面元数据
        const { data: frontMatter } = parseFrontMatter(markdown);
        
        // 智能提取封面标题
        let titleText = frontMatter.title;
        if (!titleText) {
          // 尝试从 Markdown 中提取第一个 H1 标题
          const h1Match = markdown.match(/^#\s+(.+)$/m);
          titleText = h1Match ? h1Match[1].trim() : (locale === 'zh' ? '文档标题' : 'Document Title');
        }
        
        const authorText = frontMatter.author || '';
        const dateText = formatDate(frontMatter.date, locale);
        
        return `
          <div class="cover-title">${DOMPurify.sanitize(String(titleText))}</div>
          ${authorText ? `<div class="cover-author">${DOMPurify.sanitize(authorText)}</div>` : ''}
          ${dateText ? `<div class="cover-date">${dateText}</div>` : ''}
        `;
      })()}
    </div>
  ` : ''}
  ${content}
</body>
</html>`.trim();
  } catch (error) {
    logger.error('HTML generation error:', error);
    return `<html><body><h1>Error generating HTML</h1><p>${(error as Error).message}</p></body></html>`;
  }
};

// ============================================================================
// 预渲染函数
// ============================================================================

/**
 * 预渲染 Mermaid 图表
 * 将 <pre class="mermaid"> 替换为 SVG
 */
const preRenderMermaid = async (html: string): Promise<string> => {
  // 匹配所有 mermaid 代码块
  const mermaidRegex = /<pre class="mermaid"[^>]*>([\s\S]*?)<\/pre>/g;
  const matches = [...html.matchAll(mermaidRegex)];
  
  if (matches.length === 0) {
    return html;
  }
  
  logger.log(`Pre-rendering ${matches.length} Mermaid diagram(s)...`);
  
  for (const match of matches) {
    const fullMatch = match[0];
    const code = match[1].trim();
    
    try {
      // 使用 renderMermaidSync 生成 SVG
      const svg = await renderMermaidSync(code);
      // 替换 <pre> 为 SVG
      html = html.replace(fullMatch, svg);
    } catch (error) {
      logger.error(`Failed to render Mermaid diagram:`, error);
      // 保留原始代码，添加错误提示
      html = html.replace(
        fullMatch,
        `<div class="mermaid-error" style="color: #d4462a; padding: 12px; background: #fff8f8; border: 1px solid #ffc1aa; border-radius: 6px;">Mermaid 渲染失败: ${(error as Error).message}</div>`
      );
    }
  }
  
  return html;
};

/**
 * 预渲染 MathJax 公式
 * 将 data-math 占位符替换为 SVG
 */
const preRenderMathJax = async (html: string): Promise<string> => {
  // 匹配行内公式
  const inlineRegex = /<span class="math-inline" data-math="([^"]*)">[^<]*<\/span>/g;
  const inlineMatches = [...html.matchAll(inlineRegex)];
  
  // 匹配块级公式
  const displayRegex = /<div class="math-display" data-math="([^"]*)">[^<]*<\/div>/g;
  const displayMatches = [...html.matchAll(displayRegex)];
  
  const totalMatches = inlineMatches.length + displayMatches.length;
  
  if (totalMatches === 0) {
    return html;
  }
  
  logger.log(`Pre-rendering ${totalMatches} MathJax formula(s)...`);
  
  // 渲染行内公式
  for (const match of inlineMatches) {
    const fullMatch = match[0];
    const encoded = match[1];
    const math = decodeURIComponent(encoded);
    
    try {
      const svg = await renderMathInlineAsync(math);
      html = html.replace(fullMatch, svg);
    } catch (error) {
      logger.error(`Failed to render inline math:`, error);
      html = html.replace(fullMatch, `<span style="color: #d4462a;">公式渲染失败</span>`);
    }
  }
  
  // 渲染块级公式
  for (const match of displayMatches) {
    const fullMatch = match[0];
    const encoded = match[1];
    const math = decodeURIComponent(encoded);
    
    try {
      const svg = await renderMathDisplayAsync(math);
      html = html.replace(fullMatch, svg);
    } catch (error) {
      logger.error(`Failed to render display math:`, error);
      html = html.replace(fullMatch, `<div style="color: #d4462a; padding: 12px;">公式渲染失败</div>`);
    }
  }
  
  return html;
};
