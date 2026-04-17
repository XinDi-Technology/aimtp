import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EditorPanel } from './components/EditorPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { Toolbar } from './components/Toolbar';
import { StatusBar } from './components/StatusBar';
import { TemplateSelectionPanel } from './components/TemplateSelectionPanel';
import { useAppStore } from './store/useAppStore';
import { usePDFExport, useFontLoading } from './hooks';

function App() {
  console.log('[Aimtp] App component rendering...');
  const { locale, showEditor, showTemplateSelection } = useAppStore();
  console.log('[Aimtp] App store state:', { locale, showEditor, showTemplateSelection });
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
          {showTemplateSelection ? (
            <section className="template-selection-container" aria-label={locale === 'zh' ? '模板选择' : 'Template Selection'}>
              <TemplateSelectionPanel />
            </section>
          ) : (
            <div className="editor-preview" role="region" aria-label={locale === 'zh' ? '编辑器和预览' : 'Editor and Preview'}>
              {showEditor && <EditorPanel />}
              <PreviewPanel className={!showEditor ? 'preview-full-width' : ''} />
            </div>
          )}
          <StatusBar />
        </main>
      </div>
    </ErrorBoundary>
  );
}

console.log('[Aimtp] App component defined');

export default App;
