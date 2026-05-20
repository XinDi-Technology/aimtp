import type { AppState } from '../store/useAppStore';

export function getPageWidthMm(page: AppState['page']): number {
  const pageHeightMm = page.size === 'A3' ? 420 : 297
  return page.orientation === 'landscape' ? pageHeightMm : (page.size === 'A3' ? 297 : 210);
}

export interface CssVariables {
  pageSize: string;
  pageOrientation: string;
  pageWidthMm: string;
  pageHeightMm: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  maxWidth: string;
  fontBody: string;
  fontCode: string;
  fontBaseSize: string;
  codeFontSize: string;
  tableFontSize: string;
  fontLineHeight: string;
  coverPageCss: string;
  headerFooterCss: string;
  coverPadding: string;
  coverTitleSize: string;
  coverAuthorSize: string;
  coverDateSize: string;
  paragraphSpacingCss: string;
  targetDPI: string;
  [key: string]: string;
}

export function buildCssVariables(state: {
  page: AppState['page'];
  font: AppState['font'];
  cover: AppState['cover'];
  headerFooter: AppState['headerFooter'];
  preview: AppState['preview'];
}): CssVariables {
  const { page, font, cover, headerFooter, preview } = state;

  const pageWidthMm = getPageWidthMm(page);
  const pageHeightMm = page.size === 'A3' ? (page.orientation === 'landscape' ? 297 : 420) : (page.orientation === 'landscape' ? 210 : 297);

  const marginLeftMm = page.margins.left;
  const marginRightMm = page.margins.right;
  const contentWidthMm = pageWidthMm - marginLeftMm - marginRightMm;

  return {
    pageSize: page.size,
    pageOrientation: page.orientation === 'landscape' ? 'landscape' : '',
    pageWidthMm: `${pageWidthMm}mm`,
    pageHeightMm: `${pageHeightMm}mm`,
    marginTop: `${page.margins.top}mm`,
    marginRight: `${page.margins.right}mm`,
    marginBottom: `${page.margins.bottom}mm`,
    marginLeft: `${page.margins.left}mm`,
    maxWidth: `${contentWidthMm}mm`,

    fontBody: `"${font.body}"`,
    fontCode: `"${font.code}"`,
    fontBaseSize: `${font.baseSize}px`,
    codeFontSize: `${Math.round(font.baseSize * 0.8)}px`,
    tableFontSize: `${Math.round(font.baseSize * 0.8)}px`,
    fontLineHeight: String(font.lineHeight),

    coverPageCss: cover.enabled
      ? `@page :first { margin: 0; @top-left { content: none; } @top-center { content: none; } @top-right { content: none; } @bottom-left { content: none; } @bottom-center { content: none; } @bottom-right { content: none; } }`
      : '',

    headerFooterCss: headerFooter.enabled
      ? buildHeaderFooterCss(headerFooter, font.baseSize)
      : '',

    coverPadding: '50px',
    coverTitleSize: `${Math.round(font.baseSize * 2.25)}px`,
    coverAuthorSize: `${Math.round(font.baseSize * 1.25)}px`,
    coverDateSize: `${Math.round(font.baseSize * 1.1)}px`,

    paragraphSpacingCss: font.paragraphSpacing > 0
      ? `
        p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, table, pre {
          margin-bottom: ${font.paragraphSpacing}em;
        }
      `
      : '',

    targetDPI: String(preview.targetDPI),
  };
}

function buildHeaderFooterCss(
  hf: AppState['headerFooter'],
  baseSize: number
): string {
  const header = hf.header;
  const footer = hf.footer;

  const headerContent = header.content.trim();
  const footerContent = footer.content.trim();

  const hfFontSize = Math.round(baseSize * 0.8);

  // F2: 使用 content: "" 仅触发 Paged.js 创建 margin box DOM 结构
  // 实际内容文本由 HeaderFooterHandler DOM 注入
  const headerCss = headerContent
    ? `
      @page {
        @top-${header.alignment} {
          content: "";
          font-family: "${header.font}";
          font-size: ${hfFontSize}px;
        }
      }
    `
    : '';

  if (footerContent === 'pageNumber') {
    const pageCss = `
      @page {
        @bottom-${footer.alignment} {
          content: "";
          font-family: "${footer.font}";
          font-size: ${hfFontSize}px;
        }
      }
    `;
    return headerCss + pageCss;
  }

  if (footerContent === 'pageNumberTotal') {
    const pageTotalCss = `
      @page {
        @bottom-${footer.alignment} {
          content: "";
          font-family: "${footer.font}";
          font-size: ${hfFontSize}px;
        }
      }
    `;
    return headerCss + pageTotalCss;
  }

  if (footerContent) {
    const textCss = `
      @page {
        @bottom-${footer.alignment} {
          content: "";
          font-family: "${footer.font}";
          font-size: ${hfFontSize}px;
        }
      }
    `;
    return headerCss + textCss;
  }

  return headerCss;
}

function escapeCssString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function interpolate(template: string, variables: CssVariables): string {
  return template.replace(/\$\$(\w+)/g, (match, key) => {
    return variables[key] ?? match;
  });
}

export function buildFinalCss(
  template: string,
  state: {
    page: AppState['page'];
    font: AppState['font'];
    cover: AppState['cover'];
    headerFooter: AppState['headerFooter'];
    preview: AppState['preview'];
  }
): string {
  const variables = buildCssVariables(state);
  return interpolate(template, variables);
}
