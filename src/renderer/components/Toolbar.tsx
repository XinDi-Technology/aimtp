import React, { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useFileImport } from '../hooks';
import './styles.css';

interface ToolbarProps {
  onExportPdf?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = React.memo(({ onExportPdf }) => {
  const { showEditor, setShowEditor, locale, setLocale, setShowTemplateSelection, isGenerating } = useAppStore();
  const { handleImportFile } = useFileImport();

  const labels = useMemo(() => ({
    zh: {
      template: '模板',
      generating: '生成中...',
      exportPdf: '导出 PDF',
      toggleEditor: '切换编辑器',
      importFile: '导入文件',
      language: '语言',
      export: '导出',
    },
    en: {
      template: 'Template',
      generating: 'Generating...',
      exportPdf: 'Export PDF',
      toggleEditor: 'Toggle Editor',
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
        onClick={() => setShowEditor(!showEditor)}
        title={t('toggleEditor')}
        aria-label={t('toggleEditor')}
        aria-pressed={showEditor}
        data-testid="toggle-editor-btn"
      >
        <span aria-hidden="true">{showEditor ? '👁️' : '✏️'}</span>
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
