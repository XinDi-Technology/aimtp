import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { logger } from '../utils/logger';
import { generateHtml } from '../utils/htmlGenerator';
import { t } from '../../shared/i18n';

// TODO: 待功能完善后替换为自定义提示组件，避免使用原生 alert()
export const usePDFExport = () => {
  const { 
    setIsGenerating, 
    locale, 
    markdown, 
    page, 
    font, 
    extensions, 
    headerFooter, 
    cover 
  } = useAppStore();

  const validateContent = useCallback((): boolean => {
    if (!markdown.trim()) {
      alert(t('pdf-export-no-content', locale));
      return false;
    }
    return true;
  }, [markdown, locale]);

  const validateSettings = useCallback((): boolean => {
    if (!page || !page.margins) {
      alert(t('pdf-export-invalid-settings', locale));
      return false;
    }

    const marginValues = Object.values(page.margins);
    for (const margin of marginValues) {
      if (typeof margin !== 'number' || margin < 0 || margin > 100) {
        alert(t('pdf-export-invalid-settings', locale));
        return false;
      }
    }
    return true;
  }, [page, locale]);

  const generateHTMLContent = useCallback(() => {
    return generateHtml({
      markdown,
      locale,
      page,
      font,
      extensions,
      headerFooter,
      cover,
    });
  }, [markdown, locale, page, font, extensions, headerFooter, cover]);

  const handleExportPdf = useCallback(async () => {
    try {
      if (!validateContent()) return;
      if (!validateSettings()) return;

      const htmlContent = generateHTMLContent();

      if (window.electronAPI?.selectSavePath && window.electronAPI?.generatePdf && window.electronAPI?.savePdfToPath) {
        const savePath = await window.electronAPI.selectSavePath();
        if (!savePath) {
          return;
        }

        setIsGenerating(true);
        const pdfData = await window.electronAPI.generatePdf({
          markdown,
          page,
          font,
          html: htmlContent,
          locale,
        });
        
        await window.electronAPI.savePdfToPath(pdfData, savePath);
        alert(t('pdf-export-success', locale));
      } else {
        alert(t('pdf-export-needs-env', locale));
      }
    } catch (error) {
      logger.error('PDF generation error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`${t('pdf-export-failed', locale)}${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  }, [
    validateContent, 
    validateSettings, 
    generateHTMLContent, 
    markdown, 
    page, 
    font, 
    locale, 
    setIsGenerating
  ]);

  return {
    handleExportPdf,
    isGenerating: useAppStore(state => state.isGenerating),
  };
};
