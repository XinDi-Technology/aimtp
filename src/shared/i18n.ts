export interface Translations {
  [key: string]: string;
}

export interface I18nData {
  zh: Translations;
  en: Translations;
}

export const translations: I18nData = {
  zh: {
    'select-file': '选择文件',
    'pdf-filter': 'PDF文件',
    'file-read-error': '读取文件失败',
    'file-write-error': '写入文件失败',
    'pdf-generation-error': 'PDF生成失败',
  },
  en: {
    'select-file': 'Select a file',
    'pdf-filter': 'PDF Files',
    'file-read-error': 'Failed to read file',
    'file-write-error': 'Failed to write file',
    'pdf-generation-error': 'PDF generation failed',
  },
};

export function t(key: string, locale: 'zh' | 'en' = 'zh'): string {
  return translations[locale]?.[key] || translations['en'][key] || key;
}
