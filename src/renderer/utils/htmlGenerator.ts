declare const __FONTS_DIR__: string;

import { resetMarkdownIt } from './markdown';
import { FontSettings, PageSettings, ExtensionSettings, HeaderFooterSettings, CoverSettings, PreviewSettings } from '../store/useAppStore';
import { logger } from './logger';
import DOMPurify from 'dompurify';
import { getHljsTheme, getHljsBaseStyles } from './hljsThemes';
import { parseFrontMatter, formatDate } from './frontMatter';
import { renderMermaidSync } from './mermaidPlugin';
import { renderMathInlineAsync, renderMathDisplayAsync } from './mathjaxPlugin';
import { buildFinalCss, getPageWidthMm } from './cssTemplate';
import previewCssTemplate from '../assets/preview.css?raw';

type RuntimeEnvironment =
  | { type: 'browser-http'; origin: string }
  | { type: 'electron-dev'; fontsDir: string }
  | { type: 'electron-prod'; appUrl: string }
  | { type: 'fallback' };

function detectEnvironment(): RuntimeEnvironment {
  const protocol = window.location.protocol;

  if (protocol === 'http:' || protocol === 'https:') {
    return { type: 'browser-http', origin: window.location.origin };
  }

  if (protocol === 'file:') {
    const appUrl = window.location.href;
    if (appUrl.includes('src/renderer')) {
      return { type: 'electron-dev', fontsDir: __FONTS_DIR__.replace(/\\/g, '/') };
    }
    return { type: 'electron-prod', appUrl };
  }

  return { type: 'fallback' };
}

function getFontsBaseUrl(): string {
  const env = detectEnvironment();

  switch (env.type) {
    case 'browser-http':
      return `${window.location.origin}/assets/fonts/`;
    case 'electron-dev':
      return `file:///${env.fontsDir}/`;
    case 'electron-prod':
      return env.appUrl.replace(/app\.asar\/.*$/, 'dist/renderer/fonts/');
    case 'fallback':
      return `file:///${__FONTS_DIR__.replace(/\\/g, '/')}/`;
  }
}

export interface HtmlGeneratorOptions {
  markdown: string;
  locale: 'zh' | 'en';
  page: PageSettings;
  font: FontSettings;
  extensions: ExtensionSettings;
  headerFooter: HeaderFooterSettings;
  cover: CoverSettings;
  preview: PreviewSettings;
}

const transformFootnotesToPagedJs = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const footnotesContainer = doc.querySelector('.footnotes');
  if (!footnotesContainer) return html;

  const footnoteItems = footnotesContainer.querySelectorAll('li[id^="fn"]');
  const footnoteMap = new Map<string, string>();

  footnoteItems.forEach((item) => {
    const id = item.id;
    const clone = item.cloneNode(true) as HTMLElement;
    const backref = clone.querySelector('.footnote-backref');
    if (backref) backref.remove();
    footnoteMap.set(id, clone.innerHTML.trim());
  });

  const refs = doc.querySelectorAll('a.footnote-ref');
  refs.forEach((ref) => {
    const href = ref.getAttribute('href');
    if (!href) return;
    const footnoteId = href.replace('#', '');
    const content = footnoteMap.get(footnoteId);
    if (!content) return;

    const footnoteEl = doc.createElement('span');
    footnoteEl.className = 'pagedjs-footnote';
    // Paged.js 通过 CSS float: footnote 识别脚注元素，无需 data-note 属性。
    // data-note 系列属性是 Paged.js 边注 (margin notes) 使用的，会干扰脚注处理。
    footnoteEl.setAttribute('data-break-before', 'avoid');
    footnoteEl.innerHTML = content;

    // 插入到引用的父元素后面，而非 <sup> 内部
    // markdown-it 的 footnote-ref 结构为 <sup><a class="footnote-ref">...</a></sup>
    // 脚注内容（可能含块级元素）不应放在 <sup> 中
    const refParent = ref.parentElement; // 通常为 <sup>
    if (refParent && refParent.tagName === 'SUP') {
      refParent.after(footnoteEl);
      // 标记包含脚注的容器，Paged.js 用此判断是否需要处理脚注区域
      refParent.setAttribute('data-has-notes', 'true');
    } else {
      ref.parentNode?.appendChild(footnoteEl);
      if (ref.parentElement) {
        ref.parentElement.setAttribute('data-has-notes', 'true');
      }
    }
  });

  footnotesContainer.remove();

  const footnotesSep = doc.querySelector('.footnotes-sep');
  if (footnotesSep) footnotesSep.remove();

  return doc.body.innerHTML;
};

export const generateHtml = async (options: HtmlGeneratorOptions): Promise<string> => {
  const { markdown, locale, page, font, extensions, headerFooter, cover, preview } = options;

  try {
    const { data: frontMatter, content: markdownWithoutFrontMatter } = parseFrontMatter(markdown);

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

    let content = markdownWithoutFrontMatter;
    let result = md.render(content);

    logger.log(`[generateHtml] After markdown render, length: ${result.length}`);

    if (extensions.mermaid) {
      try {
        result = await preRenderMermaid(result);
      } catch (error) {
        logger.error('Mermaid pre-render error:', error);
      }
    }

    if (extensions.mathJax) {
      try {
        result = await preRenderMathJax(result);
      } catch (error) {
        logger.error('MathJax pre-render error:', error);
      }
    }

    try {
      const sanitized = DOMPurify.sanitize(result, {
        ADD_ATTR: ['target', 'id', 'data-processed'],
        ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'strong', 'em', 'br', 'hr', 'div', 'span', 'img', 'svg', 'path', 'g', 'rect', 'circle', 'text', 'tspan', 'line', 'polyline', 'polygon', 'input', 'ins', 'mark', 'sub', 'sup', 'b', 's', 'section'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'target', 'id', 'data-processed', 'd', 'fill', 'stroke', 'stroke-width', 'transform', 'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'viewBox', 'preserveAspectRatio', 'xmlns', 'font-family', 'font-size', 'text-anchor', 'dominant-baseline', 'marker-end', 'marker-start', 'type', 'checked', 'data-line', 'data-math', 'aria-label', 'role', 'rev'],
      } as any);
      result = (sanitized as unknown) as string;

      if (!result || result.trim().length === 0) {
        logger.warn('DOMPurify sanitization resulted in empty content');
      } else {
        logger.log(`DOMPurify sanitization completed, content length: ${result.length}`);
      }
    } catch (e) {
      logger.warn('DOMPurify sanitization failed:', e);
    }

    if (extensions.footnotes && extensions.footnoteMode === 'page-bottom') {
      try {
        result = transformFootnotesToPagedJs(result);
      } catch (error) {
        logger.error('Footnote transformation error:', error);
      }
    }

    if (extensions.h1PageBreak || extensions.h2PageBreak) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(result, 'text/html');
      if (extensions.h1PageBreak) {
        const h1Elements = doc.querySelectorAll('h1');
        h1Elements.forEach((el, index) => {
          if (index === 0) return;
          el.classList.add('aimtp-page-break-before');
          el.setAttribute('data-break-before', 'page');
        });
      }
      if (extensions.h2PageBreak) {
        const h2Elements = doc.querySelectorAll('h2');
        h2Elements.forEach((el, index) => {
          if (index === 0) return;
          el.classList.add('aimtp-page-break-before');
          el.setAttribute('data-break-before', 'page');
        });
      }
      result = doc.body.innerHTML;
    }

    const hljsTheme = extensions.codeTheme || 'github';

    const hljsStyles = extensions.codeHighlight
      ? `<style>${getHljsBaseStyles(font.baseSize * 0.8)}${getHljsTheme(hljsTheme)}</style>`
      : '';

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
  font-style: normal;
}
@font-face {
  font-family: 'GWM Sans UI';
  src: url('file://FONTS_PATH/GWMSansUI-Light.woff2') format('woff2');
  font-weight: 300;
  font-style: normal;
}
@font-face {
  font-family: 'JetBrains Mono';
  src: url('file://FONTS_PATH/JetBrainsMono-Regular.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'JetBrains Mono';
  src: url('file://FONTS_PATH/JetBrainsMono-Bold.woff2') format('woff2');
  font-weight: bold;
  font-style: normal;
}
@font-face {
  font-family: 'JetBrains Mono';
  src: url('file://FONTS_PATH/JetBrainsMono-Light.woff2') format('woff2');
  font-weight: 300;
  font-style: normal;
}
/* Monaspace Argon 字体 (TrueType 轮廓，避免 CFF woff2 在 printToPDF 中产生 T3Font) */
@font-face {
  font-family: 'Monaspace Argon';
  src: url('file://FONTS_PATH/MonaspaceArgonFrozen-Regular.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Monaspace Argon';
  src: url('file://FONTS_PATH/MonaspaceArgonFrozen-Bold.ttf') format('truetype');
  font-weight: bold;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Monaspace Argon';
  src: url('file://FONTS_PATH/MonaspaceArgonFrozen-Light.ttf') format('truetype');
  font-weight: 300;
  font-style: normal;
  font-display: swap;
}
`;

    const fontsBaseUrl = getFontsBaseUrl();
    let fontsCssWithRealPath = fontsCss.replace(/file:\/\/FONTS_PATH\//g, fontsBaseUrl);

    let titleText = frontMatter.title;
    if (!titleText) {
      const h1Match = markdownWithoutFrontMatter.match(/^#\s+(.+)$/m);
      titleText = h1Match ? h1Match[1].trim() : (locale === 'zh' ? '文档标题' : 'Document Title');
    }

    const finalCss = buildFinalCss(previewCssTemplate, { page, font, cover, headerFooter, preview });

    const processedCss = (headerFooter.enabled && (headerFooter.header.content === 'title' || headerFooter.footer.content === 'title'))
      ? finalCss.replace(/content:\s*"title"/g, `content: "${titleText.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
      : finalCss;

    logger.debug('[htmlGenerator] headerFooter config:', JSON.stringify({ enabled: headerFooter.enabled, headerContent: headerFooter.header.content, footerContent: headerFooter.footer.content }));
    const hasAtPage = processedCss.includes('@page');
    const hasBottomCenter = processedCss.includes('@bottom-center') || processedCss.includes('@bottom-left') || processedCss.includes('@bottom-right');
    const hasContentCounter = processedCss.includes('counter(page)');
    logger.debug('[htmlGenerator] CSS check:', { hasAtPage, hasBottomCenter, hasContentCounter });

    const finalHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
<style>${fontsCssWithRealPath}</style>${hljsStyles}
  <style data-aimtp-css>
  :root { --paper-width-mm: ${getPageWidthMm(page)}mm; }
  .cover-page { width: calc(var(--paper-width-mm) - (${page.margins.left}mm + ${page.margins.right}mm)); margin: 0 auto; }
    ${processedCss}
  </style>
</head>
<body>
  ${cover.enabled ? `
    <div class="cover-page">
      <div class="cover-content">
          <h1>${DOMPurify.sanitize(String(titleText))}</h1>
          ${frontMatter.author ? `<p class="cover-author">${DOMPurify.sanitize(frontMatter.author)}</p>` : ''}
          ${frontMatter.date ? `<p class="cover-date">${formatDate(frontMatter.date, locale)}</p>` : ''}
      </div>
    </div>
  ` : ''}
  ${result}
</body>
</html>`.trim();

    logger.log(`[generateHtml] Final HTML length: ${finalHtml.length}`);
    return finalHtml;
  } catch (error) {
    logger.error('HTML generation error:', error);
    return `<html><body><h1>Error generating HTML</h1><p>${(error as Error).message}</p></body></html>`;
  }
};

const preRenderMermaid = async (html: string): Promise<string> => {
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
      const svg = await renderMermaidSync(code);
      html = html.replace(fullMatch, svg);
    } catch (error) {
      logger.error(`Failed to render Mermaid diagram:`, error);
      html = html.replace(
        fullMatch,
        `<div class="mermaid-error" style="color: #d4462a; padding: 12px; background: #fff8f8; border: 1px solid #ffc1aa; border-radius: 6px;">Mermaid 渲染失败: ${(error as Error).message}</div>`
      );
    }
  }

  return html;
};

const preRenderMathJax = async (html: string): Promise<string> => {
  const inlineRegex = /<span class="math-inline" data-math="([^"]*)">[^<]*<\/span>/g;
  const inlineMatches = [...html.matchAll(inlineRegex)];

  const displayRegex = /<div class="math-display" data-math="([^"]*)">[^<]*<\/div>/g;
  const displayMatches = [...html.matchAll(displayRegex)];

  const totalMatches = inlineMatches.length + displayMatches.length;

  if (totalMatches === 0) {
    return html;
  }

  logger.log(`Pre-rendering ${totalMatches} MathJax formula(s)...`);

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
