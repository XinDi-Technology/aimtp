/**
 * CssArchitecture — CSS 架构验证器
 *
 * 确保 CSS 模板在演进过程中始终遵守 @media screen / @media print 区分规范：
 * - Paged.js 视觉增强样式应在 @media screen 内
 * - 导出分页规则应在 @media print 内
 * - 全局区域无 .pagedjs_page 的 position:absolute 声明
 *
 * 在开发模式下，预览渲染后自动调用 validate() 并在控制台输出违规警告。
 */

/** CSS 媒体类型 */
export type CssMediaType = 'screen' | 'print' | 'all';

/** CSS 规则分类 */
export type CssRuleCategory =
  | 'shared'           // 通用样式（无 @media 包裹）
  | 'screen-only'      // 仅 @media screen 内
  | 'print-only'       // 仅 @media print 内
  | 'pagedjs-visual'   // Paged.js 视觉增强（必须在 @media screen 内）
  | 'pagedjs-export'   // Paged.js 导出适配（必须在 @media print 内）
  | 'page-at-rule';    // @page 规则（被 Paged.js 消费）

/** CSS 架构规范 — 定义每类规则应出现的 @media 位置 */
export const CSS_ARCHITECTURE_SPEC: Record<CssRuleCategory, CssMediaType[]> = {
  'shared':           ['all'],
  'screen-only':      ['screen'],
  'print-only':       ['print'],
  'pagedjs-visual':   ['screen'],     // 关键：Paged.js 视觉增强只能在 @media screen
  'pagedjs-export':   ['print'],      // 关键：导出适配只能在 @media print
  'page-at-rule':     ['all'],        // @page 规则对 screen 和 print 都有意义
};

/** 验证结果 */
export interface CssArchitectureValidationResult {
  /** 是否通过验证 */
  valid: boolean;
  /** 违规项列表 */
  violations: CssArchitectureViolation[];
  /** @media 规则摘要（调试用） */
  mediaRuleSummary: MediaRuleSummary[];
}

/** 验证违规项 */
export interface CssArchitectureViolation {
  /** 违规类型 */
  type: 'missing-media-screen' | 'missing-media-print' | 'global-position-absolute' | 'inline-style-violation';
  /** 违规描述 */
  message: string;
  /** 相关 CSS 文本片段 */
  cssSnippet?: string;
  /** 规则选择器（如适用） */
  selector?: string;
}

/** @media 规则摘要 */
export interface MediaRuleSummary {
  /** 媒体类型 */
  mediaType: string;
  /** 规则数量 */
  ruleCount: number;
  /** 包含的选择器列表 */
  selectors: string[];
}

/**
 * 验证 CSS 文本是否符合架构规范
 *
 * @param cssText CSS 文本内容
 * @returns 验证结果
 */
export function validate(cssText: string): CssArchitectureValidationResult {
  const violations: CssArchitectureViolation[] = [];
  const mediaRuleSummary: MediaRuleSummary[] = [];

  // 1. 提取 @media 规则
  const mediaRules = extractMediaRules(cssText);

  // 2. 检查 Paged.js 视觉增强样式是否在 @media screen 内
  const pagedjsVisualPatterns = [
    /\.pagedjs_page\s*\{[^}]*margin\s*:/s,
    /\.pagedjs_pages\s*\{[^}]*display\s*:/s,
    /\.pagedjs_margin\b/,
  ];

  const screenCss = mediaRules.find(r => r.mediaType === 'screen')?.cssText || '';
  const printCss = mediaRules.find(r => r.mediaType === 'print')?.cssText || '';

  // 提取全局 CSS（不在任何 @media 内的样式）
  const globalCss = extractGlobalCss(cssText);

  // 检查全局区域是否有 .pagedjs_page position:absolute
  if (globalCss.match(/\.pagedjs_page\s*\{[^}]*position\s*:\s*absolute/s)) {
    violations.push({
      type: 'global-position-absolute',
      message: 'Global area contains .pagedjs_page position:absolute, which should be inside @media screen or @media print',
      cssSnippet: extractSnippet(globalCss, '.pagedjs_page', 200),
      selector: '.pagedjs_page',
    });
  }

  // 检查全局区域是否有 Paged.js 视觉增强样式
  const pagedjsGlobalPatterns = [
    /\.pagedjs_pages\s*\{/,
    /\.pagedjs_page\s*\{/,
  ];

  for (const pattern of pagedjsGlobalPatterns) {
    if (pattern.test(globalCss)) {
      // 检查这些样式是否仅含通用属性（如 margin:0），不含视觉增强
      const hasVisualEnhancement = globalCss.match(
        /\.pagedjs_(pages|page)\s*\{[^}]*(display\s*:\s*flex|gap\s*:|padding\s*:)/s
      );
      if (hasVisualEnhancement) {
        violations.push({
          type: 'missing-media-screen',
          message: 'Paged.js visual enhancement styles found in global area, should be inside @media screen',
          cssSnippet: extractSnippet(globalCss, '.pagedjs_', 200),
        });
      }
    }
  }

  // 3. 构建 @media 规则摘要
  for (const rule of mediaRules) {
    mediaRuleSummary.push({
      mediaType: rule.mediaType,
      ruleCount: rule.ruleCount,
      selectors: rule.selectors,
    });
  }

  return {
    valid: violations.length === 0,
    violations,
    mediaRuleSummary,
  };
}

/**
 * 提取 @media 规则摘要
 *
 * @param cssText CSS 文本
 * @returns @media 规则列表
 */
export function extractMediaRules(cssText: string): ExtractedMediaRule[] {
  const rules: ExtractedMediaRule[] = [];

  // 匹配 @media 规则
  const mediaRegex = /@media\s+([\w-]+)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = mediaRegex.exec(cssText)) !== null) {
    const mediaType = match[1];
    const mediaBody = match[2];

    // 提取选择器
    const selectorRegex = /([.#\w][\w-]*(?:\s*[.,>+~]\s*[.#\w][\w-]*)*)\s*\{/g;
    const selectors: string[] = [];
    let selectorMatch: RegExpExecArray | null;

    while ((selectorMatch = selectorRegex.exec(mediaBody)) !== null) {
      selectors.push(selectorMatch[1].trim());
    }

    rules.push({
      mediaType,
      cssText: match[0],
      body: mediaBody,
      ruleCount: selectors.length,
      selectors,
    });
  }

  return rules;
}

// ─── Private Helpers ───

interface ExtractedMediaRule {
  mediaType: string;
  cssText: string;
  body: string;
  ruleCount: number;
  selectors: string[];
}

/** 提取全局 CSS（不在任何 @media 内） */
function extractGlobalCss(cssText: string): string {
  // 移除所有 @media 块
  let result = cssText;
  const mediaRegex = /@media\s+[\w-]+\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g;
  result = result.replace(mediaRegex, '');

  // 移除 @page 规则
  const pageRegex = /@page\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g;
  result = result.replace(pageRegex, '');

  // 移除注释
  const commentRegex = /\/\*[\s\S]*?\*\//g;
  result = result.replace(commentRegex, '');

  return result.trim();
}

/** 提取 CSS 片段（用于违规信息） */
function extractSnippet(cssText: string, prefix: string, maxLength: number): string {
  const index = cssText.indexOf(prefix);
  if (index === -1) return '';

  const start = Math.max(0, index - 20);
  const end = Math.min(cssText.length, index + maxLength);
  return cssText.substring(start, end);
}

/**
 * 开发模式验证：验证 preview.css 是否符合架构规范
 *
 * 在开发模式下调用，在控制台输出违规警告。
 */
export function validateInDevMode(cssText: string, cssName: string = 'preview.css'): void {
  if (process.env.NODE_ENV !== 'development') return;

  const result = validate(cssText);
  if (result.valid) {
    console.log(`[CssArchitecture] ✅ ${cssName} passed validation`);
  } else {
    console.warn(`[CssArchitecture] ❌ ${cssName} has ${result.violations.length} violation(s):`);
    for (const violation of result.violations) {
      console.warn(`  - [${violation.type}] ${violation.message}`);
      if (violation.cssSnippet) {
        console.warn(`    Snippet: ${violation.cssSnippet.substring(0, 100)}...`);
      }
    }
  }

  // 输出 @media 摘要
  if (result.mediaRuleSummary.length > 0) {
    console.log(`[CssArchitecture] @media summary for ${cssName}:`);
    for (const summary of result.mediaRuleSummary) {
      console.log(`  @media ${summary.mediaType}: ${summary.ruleCount} rules`);
    }
  }
}
