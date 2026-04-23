/**
 * 统一的样式配置系统
 * 
 * 此模块集中管理所有动态样式，确保预览和 PDF 导出的样式完全一致。
 * 所有样式值都基于用户设置（font、page 等）动态计算，避免硬编码。
 */

import type { CSSProperties } from 'react';

export interface FontConfig {
  baseSize: number;
  lineHeight: number;
  heading: string;
  body: string;
  code: string;
}

export interface StyleOptions {
  font: FontConfig;
  /** CSS 类名前缀，默认为 'markdown-content' */
  className?: string;
}

/**
 * 标题层级系数（基于基础字号的倍数）
 */
const HEADING_SCALES = [
  Math.pow(1.2, 5), // h1: 2.48832
  Math.pow(1.2, 4), // h2: 2.0736
  Math.pow(1.2, 3), // h3: 1.728
  Math.pow(1.2, 2), // h4: 1.44
  Math.pow(1.2, 1), // h5: 1.2
  Math.pow(1.2, 0), // h6: 1.0
];

/**
 * 生成标题样式规则
 */
function generateHeadingStyles(className: string, font: FontConfig): string {
  return `
    ${className} h1 {
      font-size: ${font.baseSize * HEADING_SCALES[0]}px !important;
      line-height: ${font.lineHeight} !important;
    }
    ${className} h2 {
      font-size: ${font.baseSize * HEADING_SCALES[1]}px !important;
      line-height: ${font.lineHeight} !important;
    }
    ${className} h3 {
      font-size: ${font.baseSize * HEADING_SCALES[2]}px !important;
      line-height: ${font.lineHeight} !important;
    }
    ${className} h4 {
      font-size: ${font.baseSize * HEADING_SCALES[3]}px !important;
      line-height: ${font.lineHeight} !important;
    }
    ${className} h5 {
      font-size: ${font.baseSize * HEADING_SCALES[4]}px !important;
      line-height: ${font.lineHeight} !important;
    }
    ${className} h6 {
      font-size: ${font.baseSize * HEADING_SCALES[5]}px !important;
      line-height: ${font.lineHeight} !important;
    }
  `;
}

/**
 * 生成段落和文本样式规则
 */
function generateTextStyles(className: string, font: FontConfig): string {
  return `
    ${className} p {
      line-height: ${font.lineHeight} !important;
    }
    ${className} li {
      line-height: ${font.lineHeight} !important;
    }
    ${className} blockquote {
      line-height: ${font.lineHeight} !important;
    }
  `;
}

/**
 * 生成代码块样式规则
 */
function generateCodeStyles(className: string, font: FontConfig): string {
  return `
    ${className} pre.hljs {
      margin: ${font.lineHeight}em 0 !important;
    }
    ${className} pre.hljs ol.code-lines li {
      line-height: ${font.lineHeight} !important;
    }
  `;
}

/**
 * 生成图表间距样式规则
 */
function generateDiagramStyles(className: string, font: FontConfig): string {
  return `
    ${className} .mermaid {
      margin: ${font.lineHeight}em 0 !important;
    }
    ${className} .math-display {
      margin: ${font.lineHeight}em 0 !important;
    }
  `;
}

/**
 * 生成完整的动态样式字符串
 * 
 * @param options - 样式配置选项
 * @returns CSS 样式字符串
 */
export function generateDynamicStyles(options: StyleOptions): string {
  const { font, className = '.markdown-content' } = options;
  
  return `
    ${generateHeadingStyles(className, font)}
    ${generateTextStyles(className, font)}
    ${generateCodeStyles(className, font)}
    ${generateDiagramStyles(className, font)}
  `;
}

/**
 * 生成内联样式对象（用于 React style 属性）
 * 
 * @param font - 字体配置
 * @returns React.CSSProperties 对象
 */
export function generateInlineStyles(font: FontConfig): CSSProperties {
  return {
    fontSize: `${font.baseSize}px`,
    lineHeight: String(font.lineHeight),
    fontFamily: font.body,
    '--content-line-height': `${font.lineHeight}em`,
  } as CSSProperties;
}

/**
 * 获取标题字体大小（用于单独设置标题样式）
 * 
 * @param font - 字体配置
 * @param level - 标题层级 (1-6)
 * @returns 字体大小（像素值，不含单位）
 */
export function getHeadingFontSize(font: FontConfig, level: number): number {
  const index = Math.max(0, Math.min(5, level - 1));
  return font.baseSize * HEADING_SCALES[index];
}
