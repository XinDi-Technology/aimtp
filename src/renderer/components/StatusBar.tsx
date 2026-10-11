import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { useI18n } from '../hooks';

export const StatusBar: React.FC = () => {
  const { markdown, currentTemplate } = useAppStore();
  const { t } = useI18n();

  const wordCount = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
  const lineCount = markdown ? markdown.split('\n').length : 0;

  const templateNames: Record<string, string> = {
    zhTech: t.templatePanel.zhTechName,
    blank: t.statusBar.templateBlank,
    report: t.statusBar.templateReport,
    article: t.statusBar.templateArticle,
    documentation: t.statusBar.templateDocumentation,
  };

  // 兜底：未知模板 id 时显示「未命名」，而不是让状态栏出现空白
  const displayName = (currentTemplate && templateNames[currentTemplate]) || t.statusBar.untitled;

  return (
    <footer className="status-bar">
      <div className="status-item">
        <span>📄</span>
        <span>{displayName}</span>
      </div>
      <div className="status-item">
        <span>📊</span>
        <span>{t.statusBar.words}: {wordCount}</span>
      </div>
      <div className="status-item">
        <span>🔤</span>
        <span>{t.statusBar.lines}: {lineCount}</span>
      </div>
    </footer>
  );
};
