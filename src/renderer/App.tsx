import React, { useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PreviewPanel } from './components/PreviewPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { Toolbar } from './components/Toolbar';
import { StatusBar } from './components/StatusBar';
import { TemplateSelectionPanel } from './components/TemplateSelectionPanel';
import { useAppStore } from './store/useAppStore';
import { usePDFExport, useFontLoading, useI18n } from './hooks';

function App() {
  const { showTemplateSelection } = useAppStore();
  const { t } = useI18n();
  // Defer mounting the template panel to avoid startup layout shifts when it's not activated
  const [mountTemplate, setMountTemplate] = useState(false);
  const { handleExportPdf } = usePDFExport();

  useFontLoading();
  useEffect(() => {
    // 延后挂载模板面板，确保刚启动时 main-content 能先扩展到可用宽度
    const t = setTimeout(() => setMountTemplate(true), 0);
    return () => clearTimeout(t);
  }, []);

  // 帮助菜单「字体授权协议」：主进程读取 MD 后以"类导入"方式在此渲染进预览区
  useEffect(() => {
    const off = window.electronAPI?.onOpenDocument(({ content }) => {
      const { setMarkdown, setCurrentTemplate, bumpRenderNonce } = useAppStore.getState();
      setMarkdown(content);
      setCurrentTemplate('documentation'); // 唯一模板「中文技术文档」
      bumpRenderNonce();
    });
    return () => off?.();
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
            <section className="template-selection-inline" aria-label={t.app.templateSelection}>
              <TemplateSelectionPanel />
            </section>
          )}
            <div className="editor-preview" role="region" aria-label={t.app.preview}>
              <PreviewPanel />
            </div>
          </div>
          <StatusBar />
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
