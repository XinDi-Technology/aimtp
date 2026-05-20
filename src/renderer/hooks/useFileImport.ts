import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { logger } from '../utils/logger';

export const useFileImport = () => {
  const setMarkdown = useAppStore(state => state.setMarkdown);
  const setCurrentTemplate = useAppStore(state => state.setCurrentTemplate);

  const handleImportFile = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          setMarkdown(text);
          // TODO: [P1-问题2] 硬编码模板为 'documentation'，不合理
          // 应该保持当前模板或让用户选择
          setCurrentTemplate('documentation');
        } catch (error) {
          logger.error('Failed to read file:', error);
          alert('Failed to read file: ' + (error as Error).message);
        }
      }
    };
    input.click();
  }, [setMarkdown, setCurrentTemplate]);

  return {
    handleImportFile,
  };
};
