import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { useFileImport, useI18n } from '../hooks';

interface ToolbarProps {
  onExportPdf?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = React.memo(({ onExportPdf }) => {
  const { showTemplateSelection, setShowTemplateSelection, locale, setLocale, theme, setTheme, isGenerating } = useAppStore();
  const { handleImportFile } = useFileImport();
  const { t } = useI18n();

  // 处理主题切换
  const handleToggleTheme = () => {
    // 只在浅色和深色之间切换
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  // 获取主题图标和提示
  const getThemeInfo = () => {
    if (theme === 'light') {
      return { icon: '☀️', label: t.toolbar.themeToDark };
    } else {
      return { icon: '🌙', label: t.toolbar.themeToLight };
    }
  };

  const templateLabel = showTemplateSelection ? t.toolbar.closeTemplate : t.toolbar.template;
  const templateTitle = showTemplateSelection ? t.toolbar.closeTemplateTitle : t.toolbar.template;

  return (
    <header className="toolbar" role="banner" data-testid="toolbar">
      <button 
        className="btn btn-toolbar" 
        onClick={handleImportFile}
        aria-label={t.toolbar.importFile}
        data-testid="import-file-btn"
      >
        <span aria-hidden="true">📁</span> {t.toolbar.importFile}
      </button>
      <div className="toolbar-spacer"></div>
      <button 
        className="btn btn-toolbar lang-toggle"
        onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
        aria-label={t.toolbar.language}
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
        title={templateTitle}
        aria-label={templateTitle}
        aria-pressed={showTemplateSelection}
        data-testid="template-btn"
      >
        <span aria-hidden="true">🎨</span> {templateLabel}
      </button>
      <button 
        className="btn btn-toolbar btn-primary-action" 
        onClick={onExportPdf}
        disabled={isGenerating}
        aria-label={t.toolbar.export}
        aria-busy={isGenerating}
        data-testid="export-pdf-btn"
      >
        {isGenerating ? (
          <>
            <span className="loading-spinner" aria-hidden="true"></span>
            {t.toolbar.generating}
          </>
        ) : (
          <>
            <span aria-hidden="true">📄</span> {t.toolbar.exportPdf}
          </>
        )}
      </button>
    </header>
  );
});

Toolbar.displayName = 'Toolbar';
