import React from 'react';
import { useAppStore } from '../store/useAppStore';
import './styles.css';

export const StatusBar: React.FC = () => {
  const { markdown, currentTemplate } = useAppStore();
  
  const wordCount = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
  const lineCount = markdown.split('\n').length;
  
  const templateNames: Record<string, string> = {
    blank: '空白文档',
    report: '项目报告',
    article: '文章',
    documentation: 'API文档',
  };

  const displayName = currentTemplate ? templateNames[currentTemplate] : '未命名.md';
  
  return (
    <footer className="status-bar">
      <div className="status-item">
        <span>📄</span>
        <span>{displayName}</span>
      </div>
      <div className="status-item">
        <span>📊</span>
        <span>字 数: {wordCount}</span>
      </div>
      <div className="status-item">
        <span>🔤</span>
        <span>行数: {lineCount}</span>
      </div>
    </footer>
  );
};