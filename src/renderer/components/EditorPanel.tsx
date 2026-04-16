import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import './styles.css';
import { t } from '../../shared/i18n';

const AUTOSAVE_DEBOUNCE_MS = 2000;

// TODO: 待功能完善后考虑使用 React.memo 优化组件渲染性能
export const EditorPanel: React.FC = () => {
  const { 
    markdown, 
    setMarkdown, 
    autoSaveEnabled, 
    saveAutoSave, 
    loadAutoSave,
    lastSavedAt,
    locale 
  } = useAppStore();
  
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [savedContent, setSavedContent] = useState<string | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (autoSaveEnabled) {
      const saved = loadAutoSave();
      if (saved && saved !== markdown) {
        setSavedContent(saved);
        setShowRestoreDialog(true);
      }
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setMarkdown(newContent);
    
    if (autoSaveEnabled) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveAutoSave(newContent);
      }, AUTOSAVE_DEBOUNCE_MS);
    }
  }, [setMarkdown, autoSaveEnabled, saveAutoSave]);

  const handleRestore = useCallback(() => {
    if (savedContent) {
      setMarkdown(savedContent);
    }
    setShowRestoreDialog(false);
    setSavedContent(null);
  }, [savedContent, setMarkdown]);

  const handleIgnore = useCallback(() => {
    setShowRestoreDialog(false);
    setSavedContent(null);
  }, []);

  const formatLastSaved = useCallback(() => {
    if (!lastSavedAt) return null;
    const date = new Date(lastSavedAt);
    return date.toLocaleTimeString(locale === 'zh' ? 'zh-CN' : 'en-US');
  }, [lastSavedAt, locale]);

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="editor-panel">
      <div className="panel-header">
        {t('editor-panel-title', locale)}
        {autoSaveEnabled && lastSavedAt && (
          <span className="auto-save-indicator">
            {t('auto-save-saved-at', locale)}{formatLastSaved()}
          </span>
        )}
      </div>
      <textarea
        className="editor-textarea"
        value={markdown}
        onChange={handleChange}
        placeholder={`在此输入 Markdown 内容...

# 标题 1
## 标题 2

正文内容...

\`\`\`javascript
// 代码块
console.log('Hello');
\`\`\`

> 引用块

- 列表项 1
- 列表项 2

:::note
这是 GitHub 风格警告框
:::`}
        spellCheck={false}
      />

      {showRestoreDialog && (
        <div className="restore-dialog-overlay">
          <div className="restore-dialog">
            <h3>{t('auto-save-restore-dialog-title', locale)}</h3>
            <p>{t('auto-save-restore-dialog-message', locale)}</p>
            <div className="restore-dialog-actions">
              <button className="btn btn-ghost" onClick={handleIgnore}>
                {t('auto-save-restore-dialog-ignore', locale)}
              </button>
              <button className="btn btn-primary" onClick={handleRestore}>
                {t('auto-save-restore-dialog-restore', locale)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
