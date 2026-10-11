import { useCallback, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { exportOrchestrator } from '../orchestration/ExportOrchestrator';
import { logger } from '../utils/logger';
import { getUiText } from './useI18n';
import { t, isErrorCode } from '../../shared/i18n';

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
        },
        state.markdown,
      );

      if (!result.success) {
        // 主进程只返回错误码，按当前界面语言翻译后再展示；原始错误仅用于排查
        logger.error('PDF export failed:', result.error ?? result.errorCode);
        // 导出过程可能持续数秒，这里取实时语言，避免用导出开始前的旧值
        const locale = useAppStore.getState().locale;
        const message = isErrorCode(result.errorCode)
          ? t(result.errorCode, locale)
          : getUiText(locale).common.exportFailed;
        window.alert(message);
      }
    } catch (error) {
      logger.error('PDF export error:', error);
      window.alert(getUiText().common.exportFailedDetail);
    } finally {
      isExportingRef.current = false;
      useAppStore.getState().setIsGenerating(false);
    }
  }, []);

  return { exportPdf, handleExportPdf: exportPdf };
};

export default usePDFExport;