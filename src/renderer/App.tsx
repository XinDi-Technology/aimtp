import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PreviewPanel } from './components/PreviewPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { Toolbar } from './components/Toolbar';
import { StatusBar } from './components/StatusBar';
import { TemplateSelectionPanel } from './components/TemplateSelectionPanel';
import { useAppStore } from './store/useAppStore';
import { usePDFExport, useFontLoading } from './hooks';

function App() {
  const { locale, showTemplateSelection } = useAppStore();
  const { handleExportPdf } = usePDFExport();

  useFontLoading();

  return (
    <ErrorBoundary>
      <div className="app-container">
        <aside className="settings-panel-container">
          <SettingsPanel />
        </aside>
        <main className="main-content">
          <Toolbar onExportPdf={handleExportPdf} />
          <div className="main-content-body">
            {showTemplateSelection && (
              <section className="template-selection-inline" aria-label={locale === 'zh' ? '模板选择' : 'Template Selection'}>
                <TemplateSelectionPanel />
              </section>
            )}
            <div className="editor-preview" role="region" aria-label={locale === 'zh' ? '预览' : 'Preview'}>
              <PreviewPanel className="preview-full-width" />
            </div>
          </div>
          <StatusBar />
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
