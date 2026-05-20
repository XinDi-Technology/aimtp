/**
 * CssVariableCategories — CSS 变量分类常量
 *
 * 定义每类设置变量对应的渲染路径：
 * - visual: 纯视觉变量，只更新 CSS，不重新分页 (~56ms)
 * - layout: 布局变量，需要重新分页 (~990ms)
 * - content: 内容变量，需要完整重新渲染 (~990ms)
 *
 * 与 cssTemplate.ts 中的 CssVariables 接口和 $$ 变量名一一对应。
 * 修正记录（I7/S3）：fontBaseSize/codeFontSize/tableFontSize/coverTitleSize/coverAuthorSize/coverDateSize
 * 从 visual 移到 layout，因为字号变更可能影响分页。
 */

/** 纯视觉变量 — 只更新 CSS，不重新分页 (~56ms) */
export const VISUAL_VARIABLES: readonly string[] = [
  'fontBody',         // 字体族（不影响分页）
  'fontCode',         // 代码字体族（不影响分页）
  'fontLineHeight',   // 行高（通常不影响分页，极端由溢出检测兜底）
  'paragraphSpacingCss', // 段落间距（通常不影响分页）
] as const;

/** 布局变量 — 需要重新分页 (~990ms，字号变更可能影响内容溢出和分页) */
export const LAYOUT_VARIABLES: readonly string[] = [
  'pageSize',         // 页面尺寸 — 改变 @page 规则
  'pageOrientation',  // 页面方向 — 改变 @page 规则
  'marginTop',        // 上边距 — 改变 @page 规则
  'marginRight',      // 右边距 — 改变 @page 规则
  'marginBottom',     // 下边距 — 改变 @page 规则
  'marginLeft',       // 左边距 — 改变 @page 规则
  'fontBaseSize',     // 正文字号 — 可能影响分页
  'codeFontSize',     // 代码字号 — 可能影响分页
  'tableFontSize',    // 表格字号 — 可能影响分页
  'coverTitleSize',   // 封面标题字号 — 可能影响封面分页
  'coverAuthorSize',  // 封面作者字号 — 可能影响封面分页
  'coverDateSize',    // 封面日期字号 — 可能影响封面分页
] as const;

/** 内容变量 — 需要完整重新渲染 (~990ms) */
export const CONTENT_VARIABLES: readonly string[] = [
  'coverPageCss',     // 封面 CSS — 改变 HTML 内容结构
  'coverPadding',     // 封面内边距 — 改变 HTML 内容结构
  'headerFooterCss',  // 页眉页脚 CSS — 改变 HTML 内容结构
] as const;

/** CSS 变量分类 — 完整定义 */
export const CSS_VARIABLE_CATEGORIES = {
  visual: VISUAL_VARIABLES,
  layout: LAYOUT_VARIABLES,
  content: CONTENT_VARIABLES,
} as const;

/** CSS 变量分类接口 */
export interface CssVariableCategories {
  /** 纯视觉变量 — 只更新 CSS，不重新分页 (~56ms) */
  visual: readonly string[];
  /** 布局变量 — 需要重新分页 (~990ms) */
  layout: readonly string[];
  /** 内容变量 — 需要完整重新渲染 (~990ms) */
  content: readonly string[];
}

/** 所有变量到类别的映射（用于快速查找） */
const VARIABLE_CATEGORY_MAP = new Map<string, 'visual' | 'layout' | 'content'>();
for (const v of VISUAL_VARIABLES) VARIABLE_CATEGORY_MAP.set(v, 'visual');
for (const v of LAYOUT_VARIABLES) VARIABLE_CATEGORY_MAP.set(v, 'layout');
for (const v of CONTENT_VARIABLES) VARIABLE_CATEGORY_MAP.set(v, 'content');

/** 获取变量所属类别 */
export function getVariableCategory(variable: string): 'visual' | 'layout' | 'content' | undefined {
  return VARIABLE_CATEGORY_MAP.get(variable);
}
