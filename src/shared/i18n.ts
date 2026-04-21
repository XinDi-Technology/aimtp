export interface Translations {
  [key: string]: string;
}

export interface I18nData {
  zh: Translations;
  en: Translations;
}

export const translations: I18nData = {
  zh: {
    'save-cancelled': '保存已取消',
    'no-main-window': '没有主窗口',
    'margins-error': '边距必须小于或等于页面尺寸',
    'save-error': '保存PDF失败',
    'select-file': '选择文件',
    'pdf-filter': 'PDF文件',
    'file-read-error': '读取文件失败',
    'file-write-error': '写入文件失败',
    'pdf-generation-error': 'PDF生成失败',
    'temp-file-error': '临时文件处理失败',
    'pdf-export-success': 'PDF 导出成功！',
    'pdf-export-needs-env': 'PDF 生成需要 Electron 环境支持',
    'pdf-export-failed': 'PDF 生成失败: ',
    'pdf-export-no-content': '请先输入 Markdown 内容',
    'pdf-export-invalid-settings': '页面设置无效',

  },
  en: {
    'save-cancelled': 'Save cancelled',
    'no-main-window': 'No main window',
    'margins-error': 'Margins must be less than or equal to page size',
    'save-error': 'Failed to save PDF',
    'select-file': 'Select a file',
    'pdf-filter': 'PDF Files',
    'file-read-error': 'Failed to read file',
    'file-write-error': 'Failed to write file',
    'pdf-generation-error': 'PDF generation failed',
    'temp-file-error': 'Failed to handle temporary file',
    'pdf-export-success': 'PDF exported successfully!',
    'pdf-export-needs-env': 'PDF generation requires Electron environment',
    'pdf-export-failed': 'PDF generation failed: ',
    'pdf-export-no-content': 'Please enter Markdown content first',
    'pdf-export-invalid-settings': 'Invalid page settings',

  },
};

export function t(key: string, locale: 'zh' | 'en' = 'zh'): string {
  return translations[locale]?.[key] || translations['en'][key] || key;
}
