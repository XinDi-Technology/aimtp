/**
 * SettingChangeClassifier — 设置变更分类器
 *
 * 区分设置变更类型（visual-only / layout-change / content-change），
 * 决定最优渲染路径：
 * - visual-only: 只替换 <style data-aimtp-css> textContent (~56ms)
 * - layout-change: 重新分页 (~990ms)
 * - content-change: 完整重新渲染 (~990ms)
 *
 * 分类依据基于 CssVariableCategories 中定义的变量类别映射。
 * 多个变更同时发生时，按优先级 content > layout > visual 返回最高级别。
 */

import type { PageSettings, FontSettings, CoverSettings, HeaderFooterSettings } from '../store/useAppStore';
import {
  CSS_VARIABLE_CATEGORIES,
  getVariableCategory,
} from './CssVariableCategories';

/** 设置变更分类 — 决定渲染路径 */
export type SettingChangeCategory = 'visual-only' | 'layout-change' | 'content-change';

/** 分类结果（含诊断信息） */
export interface ClassifyResult {
  /** 变更类别 */
  category: SettingChangeCategory;
  /** 变更的变量名列表 */
  changedVariables: string[];
  /** 各变更变量的类别映射 */
  variableCategories: Map<string, 'visual' | 'layout' | 'content'>;
}

/** 应用设置快照 — 用于与 next 比较差异 */
export interface AppSettingsSnapshot {
  page: PageSettings;
  font: FontSettings;
  cover: CoverSettings;
  headerFooter: HeaderFooterSettings;
}

/**
 * 设置变更分类器
 *
 * 用法：
 *   const classifier = new SettingChangeClassifier();
 *   const result = classifier.classify(prevSettings, nextSettings);
 *   // result.category: 'visual-only' | 'layout-change' | 'content-change'
 */
export class SettingChangeClassifier {
  /**
   * 分类设置变更
   *
   * @param prev 之前的设置快照
   * @param next 之后的设置快照
   * @returns 分类结果
   */
  classify(prev: AppSettingsSnapshot, next: AppSettingsSnapshot): ClassifyResult {
    const changedVariables = this.detectChangedVariables(prev, next);
    const variableCategories = new Map<string, 'visual' | 'layout' | 'content'>();

    if (changedVariables.length === 0) {
      return { category: 'visual-only', changedVariables: [], variableCategories };
    }

    // 确定最高优先级类别
    let maxCategory: 'visual' | 'layout' | 'content' = 'visual';
    const PRIORITY: Record<string, number> = { visual: 0, layout: 1, content: 2 };

    for (const variable of changedVariables) {
      const cat = getVariableCategory(variable);
      if (cat && PRIORITY[cat] > PRIORITY[maxCategory]) {
        maxCategory = cat;
      }
      variableCategories.set(variable, cat ?? 'visual');
    }

    // 映射到 SettingChangeCategory
    const category: SettingChangeCategory =
      maxCategory === 'content' ? 'content-change' :
      maxCategory === 'layout' ? 'layout-change' :
      'visual-only';

    return { category, changedVariables, variableCategories };
  }

  /** 获取 CSS 变量分类定义 */
  getVariableCategories() {
    return CSS_VARIABLE_CATEGORIES;
  }

  /**
   * 检测变更的变量名
   *
   * 将 AppSettingsSnapshot 中的嵌套结构扁平化为 CSS 变量名-值对，
   * 比较 prev 和 next 的差异。
   */
  private detectChangedVariables(
    prev: AppSettingsSnapshot,
    next: AppSettingsSnapshot,
  ): string[] {
    const changed: string[] = [];

    // page 相关变量
    if (prev.page.size !== next.page.size) changed.push('pageSize');
    if (prev.page.orientation !== next.page.orientation) changed.push('pageOrientation');
    if (prev.page.margins.top !== next.page.margins.top) changed.push('marginTop');
    if (prev.page.margins.right !== next.page.margins.right) changed.push('marginRight');
    if (prev.page.margins.bottom !== next.page.margins.bottom) changed.push('marginBottom');
    if (prev.page.margins.left !== next.page.margins.left) changed.push('marginLeft');

    // font 相关变量
    if (prev.font.body !== next.font.body) changed.push('fontBody');
    if (prev.font.code !== next.font.code) changed.push('fontCode');
    if (prev.font.baseSize !== next.font.baseSize) changed.push('fontBaseSize');
    if (prev.font.lineHeight !== next.font.lineHeight) changed.push('fontLineHeight');
    if (prev.font.paragraphSpacing !== next.font.paragraphSpacing) changed.push('paragraphSpacingCss');

    // cover 相关变量
    if (prev.cover.enabled !== next.cover.enabled) {
      changed.push('coverPageCss');
      changed.push('coverPadding');
    }

    // headerFooter 相关变量
    if (
      prev.headerFooter.enabled !== next.headerFooter.enabled ||
      prev.headerFooter.header.content !== next.headerFooter.header.content ||
      prev.headerFooter.header.alignment !== next.headerFooter.header.alignment ||
      prev.headerFooter.header.font !== next.headerFooter.header.font ||
      prev.headerFooter.footer.content !== next.headerFooter.footer.content ||
      prev.headerFooter.footer.alignment !== next.headerFooter.footer.alignment ||
      prev.headerFooter.footer.font !== next.headerFooter.footer.font
    ) {
      changed.push('headerFooterCss');
    }

    // font.baseSize 衍生的字号变量
    // codeFontSize, tableFontSize 由 baseSize 衍生，baseSize 变更已涵盖
    // coverTitleSize, coverAuthorSize, coverDateSize 也由 baseSize 衍生
    if (prev.font.baseSize !== next.font.baseSize) {
      // 这些已在 layout 类别中，baseSize 变更会触发 layout-change
      // 无需重复添加，但确保 codeFontSize 等也标记为变更
      if (!changed.includes('codeFontSize')) changed.push('codeFontSize');
      if (!changed.includes('tableFontSize')) changed.push('tableFontSize');
      if (!changed.includes('coverTitleSize')) changed.push('coverTitleSize');
      if (!changed.includes('coverAuthorSize')) changed.push('coverAuthorSize');
      if (!changed.includes('coverDateSize')) changed.push('coverDateSize');
    }

    return changed;
  }
}

/** 便捷函数：分类设置变更 */
export function classifySettingChange(
  prev: AppSettingsSnapshot,
  next: AppSettingsSnapshot,
): SettingChangeCategory {
  return new SettingChangeClassifier().classify(prev, next).category;
}

/** 创建设置快照 */
export function createSettingsSnapshot(settings: AppSettingsSnapshot): AppSettingsSnapshot {
  return {
    page: { ...settings.page, margins: { ...settings.page.margins } },
    font: { ...settings.font },
    cover: { ...settings.cover },
    headerFooter: {
      ...settings.headerFooter,
      header: { ...settings.headerFooter.header },
      footer: { ...settings.headerFooter.footer },
    },
  };
}
