import React, { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useFileImport } from '../hooks';
import './styles.css';

interface ToolbarProps {
  onExportPdf?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = React.memo(({ onExportPdf }) => {
  const { showEditor, setShowEditor, showTemplateSelection, setShowTemplateSelection, locale, setLocale, theme, setTheme, isGenerating } = useAppStore();
  const { handleImportFile } = useFileImport();

  // 处理布局切换按钮点击
  const handleToggleLayout = () => {
    if (showTemplateSelection) {
      // 如果正在显示模板选择，直接关闭并隐藏编辑器（预览全宽）
      setShowTemplateSelection(false);
      setShowEditor(false);
    } else {
      // 否则切换编辑器显示/隐藏
      setShowEditor(!showEditor);
    }
  };

  // 处理主题切换
  const handleToggleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  // 获取主题图标和提示
  const getThemeInfo = () => {
    switch (theme) {
      case 'light':
        return { icon: '☀️', label: locale === 'zh' ? '浅色模式' : 'Light' };
      case 'dark':
        return { icon: '🌙', label: locale === 'zh' ? '暗色模式' : 'Dark' };
      case 'system':
        return { icon: '💻', label: locale === 'zh' ? '跟随系统' : 'System' };
    }
  };

  const labels = useMemo(() => ({
    zh: {
      template: '模板',
      generating: '生成中...',
      exportPdf: '导出 PDF',
      focusPreview: '专注预览',
      showEditor: '显示编辑器',
      importFile: '导入文件',
      language: '语言',
      export: '导出',
    },
    en: {
      template: 'Template',
      generating: 'Generating...',
      exportPdf: 'Export PDF',
      focusPreview: 'Focus Preview',
      showEditor: 'Show Editor',
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
      <button 
        className="btn btn-toolbar"
        onClick={handleToggleLayout}
        title={showEditor ? t('focusPreview') : t('showEditor')}
        aria-label={showEditor ? t('focusPreview') : t('showEditor')}
        aria-pressed={showEditor}
        data-testid="toggle-editor-btn"
      >
        <span aria-hidden="true">{showEditor ? '🔍' : '✏️'}</span>
        <span className="btn-text">{showEditor ? t('focusPreview') : t('showEditor')}</span>
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
        onClick={() => setShowTemplateSelection(true)}
        aria-label={t('template')}
        data-testid="template-btn"
      >
        <span aria-hidden="true">🎨</span> {t('template')}
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
