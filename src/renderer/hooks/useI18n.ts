import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTranslations } from '../../shared/i18n';
import type { Locale, Translations } from '../../shared/i18n';

/**
 * 获取界面文案（只影响界面，不影响导入文档的排版）
 *
 * 用法：
 *   const { locale, t } = useI18n();
 *   t.toolbar.importFile
 */
export function useI18n(): { locale: Locale; t: Translations } {
  const locale = useAppStore((s) => s.locale);
  const t = useMemo(() => getTranslations(locale), [locale]);
  return { locale, t };
}

/** 非组件场景（class 组件、事件回调、普通函数）读取界面文案 */
export function getUiText(locale: Locale = useAppStore.getState().locale): Translations {
  return getTranslations(locale);
}
