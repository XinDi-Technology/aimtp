import React, { useEffect } from 'react';
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

  useEffect(() => {
    const triggerResize = () => {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
        document.body.style.display = 'none';
        document.body.offsetHeight;
        document.body.style.display = '';
      });
    };
    window.addEventListener('resize', triggerResize);
    return () => window.removeEventListener('resize', triggerResize);
  }, []);

  return (
    <ErrorBoundary>
      <div className="app-container">
        <aside className="settings-panel-container">
          <SettingsPanel />
        </aside>
        {showTemplateSelection && (
          <section className="template-selection-inline" aria-label={locale === 'zh' ? '模板选择' : 'Template Selection'}>
            <TemplateSelectionPanel />
          </section>
        )}
        <main className="main-content">
          <Toolbar onExportPdf={handleExportPdf} />
          <div className="editor-preview" role="region" aria-label={locale === 'zh' ? '预览' : 'Preview'}>
            <PreviewPanel className="preview-full-width" />
          </div>
          <StatusBar />
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
