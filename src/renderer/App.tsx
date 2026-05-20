import React, { useEffect, useState } from 'react';
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
  // Defer mounting the template panel to avoid startup layout shifts when it's not activated
  const [mountTemplate, setMountTemplate] = useState(false);
  const { handleExportPdf } = usePDFExport();

  useFontLoading();
  useEffect(() => {
    // 延后挂载模板面板，确保刚启动时 main-content 能先扩展到可用宽度
    const t = setTimeout(() => setMountTemplate(true), 0);
    return () => clearTimeout(t);
  }, []);

  
  return (
    <ErrorBoundary>
      <div className="app-container">
        <aside className="settings-panel-container">
          <SettingsPanel />
        </aside>
        <main className="main-content">
          <Toolbar onExportPdf={handleExportPdf} />
          <div className="main-content-body">
          {mountTemplate && showTemplateSelection && (
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
