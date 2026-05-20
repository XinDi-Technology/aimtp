import { useCallback, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { exportOrchestrator } from '../orchestration/ExportOrchestrator';
import { layoutDOMManager } from '../domain/LayoutDOMManager';
import { logger } from '../utils/logger';

const USE_NEW_EXPORT_PIPELINE = true;

const usePDFExport = () => {
  const isExportingRef = useRef(false);

  const exportPdf = useCallback(async () => {
    if (isExportingRef.current) {
      logger.log('Export already in progress, skipping...');
      return;
    }

    isExportingRef.current = true;
    useAppStore.getState().setIsGenerating(true);

    try {
      const state = useAppStore.getState();

      if (USE_NEW_EXPORT_PIPELINE) {
        const result = await exportOrchestrator.start(
          {
            pageSize: state.page.size,
            orientation: state.page.orientation,
            locale: state.locale,
          },
          state.markdown,
        );

        if (!result.success) {
          window.alert(result.error || 'PDF 导出失败');
        }
      } else {
        const lastResult = (window as any).__aimtpGetLastRenderResult?.();
        if (!lastResult) {
          window.alert('请等待预览渲染完成后再导出');
          return;
        }

        const { prepareExportHtml } = await import('../utils/exportHtmlGenerator');
        const { html: renderedHtml, totalPages } = lastResult;
        const exportHtml = prepareExportHtml(renderedHtml, totalPages);

        const pdfData = await (window as any).electronAPI?.exportPdf?.(
          exportHtml, state.page, state.locale,
        );
        if (!pdfData) {
          window.alert('PDF 生成失败，请重试');
          return;
        }

        const savePath = await (window as any).electronAPI?.selectSavePath?.();
        if (!savePath) {
          return;
        }

        await (window as any).electronAPI?.savePdfToPath?.(pdfData, savePath);
      }
    } catch (error) {
      logger.error('PDF export error:', error);
      window.alert('PDF 导出失败，请查看控制台获取详细信息');
    } finally {
      isExportingRef.current = false;
      useAppStore.getState().setIsGenerating(false);
    }
  }, []);

  return { exportPdf, handleExportPdf: exportPdf };
};

export default usePDFExport;