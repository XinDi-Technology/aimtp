export interface Translations {
  [key: string]: string;
}

export interface I18nData {
  zh: Translations;
  en: Translations;
}

export const translations: I18nData = {
  zh: {
    'file-write-error': '写入文件失败',
    'pdf-generation-error': 'PDF生成失败',
  },
  en: {
    'file-write-error': 'Failed to write file',
    'pdf-generation-error': 'PDF generation failed',
  },
};

export function t(key: string, locale: 'zh' | 'en' = 'zh'): string {
  return translations[locale]?.[key] || translations['en'][key] || key;
}
