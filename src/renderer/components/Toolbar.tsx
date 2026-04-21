import React, { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useFileImport } from '../hooks';
import './styles.css';

interface ToolbarProps {
  onExportPdf?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = React.memo(({ onExportPdf }) => {
  const { showTemplateSelection, setShowTemplateSelection, locale, setLocale, theme, setTheme, isGenerating } = useAppStore();
  const { handleImportFile } = useFileImport();

  // 处理主题切换
  const handleToggleTheme = () => {
    // 只在浅色和深色之间切换
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  // 获取主题图标和提示
  const getThemeInfo = () => {
    if (theme === 'light') {
      return { icon: '☀️', label: locale === 'zh' ? '切换到暗色模式' : 'Switch to Dark Mode' };
    } else {
      return { icon: '🌙', label: locale === 'zh' ? '切换到浅色模式' : 'Switch to Light Mode' };
    }
  };

  const labels = useMemo(() => ({
    zh: {
      template: '模板',
      generating: '生成中...',
      exportPdf: '导出 PDF',
      importFile: '导入文件',
      language: '语言',
      export: '导出',
    },
    en: {
      template: 'Template',
      generating: 'Generating...',
      exportPdf: 'Export PDF',
      importFile: 'Import File',
      language: 'Language',
      export: 'Export',
    },
  }), []);

  const t = (key: keyof typeof labels.zh) => labels[locale][key];

  return (
    <header className="toolbar" role="banner" data-testid="toolbar">
      <button 
        className="btn btn-toolbar" 
        onClick={handleImportFile}
        aria-label={t('importFile')}
        data-testid="import-file-btn"
      >
        <span aria-hidden="true">📁</span> {locale === 'zh' ? '导入文件' : 'Import'}
      </button>
      <div className="toolbar-spacer"></div>
      <button 
        className="btn btn-toolbar lang-toggle"
        onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
        aria-label={t('language')}
        data-testid="lang-toggle-btn"
      >
        {locale === 'zh' ? '中文' : 'EN'}
      </button>
      <button 
        className="btn btn-toolbar theme-toggle"
        onClick={handleToggleTheme}
        title={getThemeInfo().label}
        aria-label={getThemeInfo().label}
        data-testid="theme-toggle-btn"
      >
        <span aria-hidden="true">{getThemeInfo().icon}</span>
      </button>
      <button 
        className="btn btn-toolbar"
        onClick={() => setShowTemplateSelection(!showTemplateSelection)}
        title={showTemplateSelection ? (locale === 'zh' ? '关闭模板选择' : 'Close Template Selection') : t('template')}
        aria-label={showTemplateSelection ? (locale === 'zh' ? '关闭模板选择' : 'Close Template Selection') : t('template')}
        aria-pressed={showTemplateSelection}
        data-testid="template-btn"
      >
        <span aria-hidden="true">🎨</span> {showTemplateSelection ? (locale === 'zh' ? '关闭' : 'Close') : t('template')}
      </button>
      <button 
        className="btn btn-toolbar btn-primary-action" 
        onClick={onExportPdf}
        disabled={isGenerating}
        aria-label={t('export')}
        aria-busy={isGenerating}
        data-testid="export-pdf-btn"
      >
        {isGenerating ? (
          <>
            <span className="loading-spinner" aria-hidden="true"></span>
            {t('generating')}
          </>
        ) : (
          <>
            <span aria-hidden="true">📄</span> {t('exportPdf')}
          </>
        )}
      </button>
    </header>
  );
});

Toolbar.displayName = 'Toolbar';
