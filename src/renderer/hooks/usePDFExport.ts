import { useCallback, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { exportOrchestrator } from '../orchestration/ExportOrchestrator';
import { logger } from '../utils/logger';

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