import { resetMarkdownIt } from './markdown';
import { FontSettings, PageSettings, ExtensionSettings, HeaderFooterSettings, CoverSettings } from '../store/useAppStore';
import { logger } from './logger';
import DOMPurify from 'dompurify';
import { getHljsTheme, getHljsBaseStyles } from './hljsThemes';
import { parseFrontMatter, formatDate } from './frontMatter';
import { renderMermaidSync } from './mermaidPlugin';
import { renderMathInlineAsync, renderMathDisplayAsync } from './mathjaxPlugin';
import { generateDynamicStyles } from './styleConfig';

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
    // 从 Front Matter 提取元数据，并获取去除 Front Matter 后的内容
    const { data: frontMatter, content: markdownWithoutFrontMatter } = parseFrontMatter(markdown);
    
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
      githubAlerts: extensions.githubAlerts,
    });
    
    // 使用去除 Front Matter 后的内容进行渲染
    let content = markdownWithoutFrontMatter;
    
    // 先渲染 Markdown 为 HTML
    let result = md.render(content);
    
    // 预渲染 Mermaid 图表（在渲染后的HTML上操作）
    if (extensions.mermaid) {
      try {
        result = await preRenderMermaid(result);
      } catch (error) {
        logger.error('Mermaid pre-render error:', error);
      }
    }
    
    // 预渲染 MathJax 公式（在渲染后的HTML上操作）
    if (extensions.mathJax) {
      try {
        result = await preRenderMathJax(result);
      } catch (error) {
        logger.error('MathJax pre-render error:', error);
      }
    }
    
    // 对渲染后的 HTML 进行消毒
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sanitized = DOMPurify.sanitize(result, {
        ADD_ATTR: ['target', 'id', 'data-processed'],
        ALLOW_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'strong', 'em', 'br', 'hr', 'div', 'span', 'img', 'svg', 'path', 'g', 'rect', 'circle', 'text', 'tspan', 'line', 'polyline', 'polygon'],
        ALLOW_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'target', 'id', 'data-processed', 'd', 'fill', 'stroke', 'stroke-width', 'transform', 'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'viewBox', 'preserveAspectRatio', 'xmlns', 'font-family', 'font-size', 'text-anchor', 'dominant-baseline', 'marker-end', 'marker-start'],
      } as any);
      result = (sanitized as unknown) as string;
    } catch (e) {
      logger.warn('DOMPurify sanitization failed:', e);
    }

    const isPortrait = page.orientation === 'portrait';
    const maxWidth = page.size === 'A4' 
      ? (isPortrait ? '210mm' : '297mm')
      : page.size === 'A3'
      ? (isPortrait ? '297mm' : '420mm')
      : '100%';
    // Ensure cover page width aligns with content width across A4/A3 and orientation
    const paperWidthMm = page.size === 'A4' ? (isPortrait ? 210 : 297) : page.size === 'A3' ? (isPortrait ? 297 : 420) : 210;
    const coverLeftMm = page.margins.left;
    const coverRightMm = page.margins.right;

    // 获取 highlight.js 主题样式（本地化，无 CDN 依赖）
    const hljsTheme = extensions.codeTheme || 'github';
    
    const hljsStyles = extensions.codeHighlight 
      ? `<style>${getHljsBaseStyles()}${getHljsTheme(hljsTheme)}</style>` 
      : '';

    // 使用绝对路径的 @font-face，确保 PDF 导出时字体能被正确加载
const fontsCss = `
@font-face {
  font-family: 'GWM Sans UI';
  src: url('file://FONTS_PATH/GWMSansUI-Regular.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'GWM Sans UI';
  src: url('file://FONTS_PATH/GWMSansUI-Bold.woff2') format('woff2');
  font-weight: bold;
}
@font-face {
  font-family: 'JetBrains Mono';
  src: url('file://FONTS_PATH/JetBrainsMono-Regular.woff2') format('woff2');
  font-weight: normal;
}
@font-face {
  font-family: 'JetBrains Mono';
  src: url('file://FONTS_PATH/JetBrainsMono-Bold.woff2') format('woff2');
  font-weight: bold;
}
@font-face {
  font-family: 'JetBrains Mono';
  src: url('file://FONTS_PATH/JetBrainsMono-Light.woff2') format('woff2');
  font-weight: 300;
}
@font-face {
  font-family: 'Monaspace Argon';
  src: url('file://FONTS_PATH/MonaspaceArgon-Regular.woff2') format('woff2');
  font-weight: normal;
}
@font-face {
  font-family: 'Monaspace Argon';
  src: url('file://FONTS_PATH/MonaspaceArgon-Bold.woff2') format('woff2');
  font-weight: bold;
}
@font-face {
  font-family: 'Monaspace Argon';
  src: url('file://FONTS_PATH/MonaspaceArgon-Light.woff2') format('woff2');
  font-weight: 300;
}
`;

    // 获取字体文件的实际路径（相对于应用根目录）
    // 在 Electron 中，使用 file:// 协议访问本地文件
    // 开发环境：Vite 服务器运行在 localhost，字体通过 @import 加载
    // 生产环境：需要使用 file:// 协议访问打包后的字体文件
    const isDev = window.location.hostname === 'localhost';
    let fontsCssWithRealPath = fontsCss;
    
    if (!isDev) {
      // 生产环境：字体文件会被复制到 dist 目录
      // 使用相对路径，Electron 会正确解析
      fontsCssWithRealPath = fontsCss.replace(/file:\/\/FONTS_PATH\//g, './');
    } else {
      // 开发环境：移除占位符，让浏览器使用已加载的字体
      // （字体已经通过 styles.css -> fonts.css 加载）
      fontsCssWithRealPath = fontsCss.replace(/file:\/\/FONTS_PATH\//g, '../fonts/');
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
<style>${fontsCssWithRealPath}${hljsStyles}</style>
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
  :root { --paper-width-mm: ${paperWidthMm}mm; --cover-left-mm: ${coverLeftMm}mm; --cover-right-mm: ${coverRightMm}mm; }
  .cover-page { width: calc(var(--paper-width-mm) - (var(--cover-left-mm) + var(--cover-right-mm))); }
    body {
      font-family: ${font.body}, sans-serif !important;
      font-size: ${font.baseSize}px;
      line-height: ${font.lineHeight};
      max-width: ${maxWidth};
      margin: 0 auto;
      padding: ${page.margins.top}mm ${page.margins.right}mm ${page.margins.bottom}mm ${page.margins.left}mm;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: ${font.heading}, sans-serif;
    }
    /* 动态样式（基于用户设置） */
    ${generateDynamicStyles({
      font: {
        baseSize: font.baseSize,
        lineHeight: font.lineHeight,
        heading: font.heading,
        body: font.body,
        code: font.code,
      },
      className: '', // 不使用类名前缀，直接应用到全局
    })}
    pre, code {
      font-family: ${font.code}, monospace;
      font-size: inherit; /* 继承父元素的 font-size */
    }
    pre {
      padding: 1em;
      border-radius: 6px;
      overflow-x: visible;
      overflow-wrap: break-word;
      word-wrap: break-word;
      white-space: pre-wrap;
    }
    code {
      padding: 2px 6px;
      border-radius: 4px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    pre code {
      padding: 0;
    }
    pre.hljs {
      position: relative;
      padding: 1em;
      margin: ${font.lineHeight}em 0;
      line-height: ${font.lineHeight};
    }
    pre.hljs ol.code-lines {
      list-style: none;
      margin: 0;
      margin-left: 3em;
      padding: 0;
      line-height: 1; /* 重置浏览器默认行高 */
    }
    pre.hljs ol.code-lines li {
      position: relative;
      padding-left: 0.5em;
    }
    pre.hljs ol.code-lines li .line-num {
      position: absolute;
      left: -3em;
      top: 0;
      width: 2.8em;
      height: 100%;
      border-right: 1px solid #d0d7de;
      text-align: center;
      padding-right: 0;
      color: #6a737d;
      user-select: none;
    }
    pre.hljs ol.code-lines li .line-num::before {
      content: attr(data-line);
      display: block;
    }
    pre.hljs b.lang-name {
      position: absolute;
      top: 4px;
      right: 8px;
      z-index: 10;
      color: #999;
      font-size: 12px;
      font-weight: normal;
      pointer-events: none;
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
      table-layout: fixed;
      word-wrap: break-word;
    }
    th, td {
      border: 1px solid #e5e3dd;
      padding: 8px 16px;
      text-align: left;
      overflow: hidden;
    }
    th {
      background: #f5f4f0;
      font-weight: 600;
    }
    tr {
      page-break-inside: avoid;
    }
    /* GitHub Alerts - 使用插件生成的标准类名 */
    .markdown-alert {
      border-radius: 6px;
      padding: 16px;
      margin: 16px 0;
      background: #f6f8fa;
      border: 1px solid #d0d7de;
    }
    .markdown-alert.markdown-alert-note {
      border-left: 4px solid #0969da;
    }
    .markdown-alert.markdown-alert-tip {
      border-left: 4px solid #1a7f37;
    }
    .markdown-alert.markdown-alert-important {
      border-left: 4px solid #8250df;
    }
    .markdown-alert.markdown-alert-warning {
      border-left: 4px solid #bf8700;
    }
    .markdown-alert.markdown-alert-caution {
      border-left: 4px solid #cf222e;
    }
    .markdown-alert .markdown-alert-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      margin-bottom: 8px;
      font-size: 14px;
      line-height: 1.5;
    }
    /* Alert 标题中的 SVG 图标 */
    .markdown-alert .markdown-alert-title svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }
    .markdown-alert.markdown-alert-note .markdown-alert-title {
      color: #0969da;
    }
    .markdown-alert.markdown-alert-tip .markdown-alert-title {
      color: #1a7f37;
    }
    .markdown-alert.markdown-alert-important .markdown-alert-title {
      color: #8250df;
    }
    .markdown-alert.markdown-alert-warning .markdown-alert-title {
      color: #bf8700;
    }
    .markdown-alert.markdown-alert-caution .markdown-alert-title {
      color: #cf222e;
    }
    .markdown-alert p:last-child {
      margin-bottom: 0;
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
      padding: 0 ${page.margins.left}mm ${page.margins.right}mm;
      box-sizing: border-box;
    }
    .cover-content {
      text-align: center;
      display: block;
      width: 100%;
      max-width: calc(100% - ${page.margins.left + page.margins.right}mm);
      margin: 0 auto;
    }
    .cover-content h1 {
      display: block;
      font-size: ${font.baseSize * 2.5}px;
      font-weight: bold;
      margin: 0 0 20px 0;
      padding: 0;
      font-family: ${font.heading}, sans-serif;
      writing-mode: horizontal-tb;
      text-orientation: mixed;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .cover-author {
      display: block;
      font-size: ${font.baseSize * 1.5}px;
      color: #666;
      margin: 0 0 10px 0;
      padding: 0;
      font-family: ${font.body}, sans-serif;
      writing-mode: horizontal-tb;
      text-orientation: mixed;
    }
    .cover-date {
      display: block;
      font-size: ${font.baseSize * 1.2}px;
      color: #999;
      margin: 0;
      padding: 0;
      font-family: ${font.body}, sans-serif;
      writing-mode: horizontal-tb;
      text-orientation: mixed;
    }
    /* Mermaid 图表样式 */
    .mermaid {
      display: flex;
      justify-content: center;
      align-items: center;
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
      <div class="cover-content">
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
            <h1>${DOMPurify.sanitize(String(titleText))}</h1>
            ${authorText ? `<p class="cover-author">${DOMPurify.sanitize(authorText)}</p>` : ''}
            ${dateText ? `<p class="cover-date">${dateText}</p>` : ''}
          `;
        })()}
      </div>
    </div>
  ` : ''}
  ${result}
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
