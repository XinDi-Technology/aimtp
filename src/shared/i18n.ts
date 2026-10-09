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
    'template-invalid-id': '模板 ID 不合法',
    'template-invalid-name': '模板名称不能为空',
    'template-write-error': '模板写入失败',
  },
  en: {
    'file-write-error': 'Failed to write file',
    'pdf-generation-error': 'PDF generation failed',
    'template-invalid-id': 'Invalid template id',
    'template-invalid-name': 'Template name cannot be empty',
    'template-write-error': 'Failed to write template',
  },
};

export function t(key: string, locale: 'zh' | 'en' = 'zh'): string {
  return translations[locale]?.[key] || translations['en'][key] || key;
}
