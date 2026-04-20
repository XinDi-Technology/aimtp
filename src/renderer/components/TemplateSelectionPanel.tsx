import React from 'react';
import { useAppStore, TEMPLATES } from '../store/useAppStore';
import './styles.css';

const templateList = [
  { key: 'blank', name: '空白文档', nameEn: 'Blank', icon: '📄', desc: '新建空白文档', descEn: 'Create new document' },
  { key: 'report', name: '项目报告', nameEn: 'Report', icon: '📊', desc: '包含数据表格和图表', descEn: 'With data tables and charts' },
  { key: 'article', name: '文章', nameEn: 'Article', icon: '📝', desc: '文章和博客格式', descEn: 'Article and blog format' },
  { key: 'documentation', name: 'API文档', nameEn: 'API Doc', icon: '📚', desc: '技术文档格式', descEn: 'Technical documentation' },
];

export const TemplateSelectionPanel: React.FC = () => {
  const { 
    locale, 
    customTemplates, 
    selectPresetTemplate, 
    applyTemplate, 
    deleteTemplate,
    setShowTemplateSelection 
  } = useAppStore();

  return (
    <div className="template-selection-inline-panel">
      <div className="template-selection-content">
        {/* 预设模板 */}
        <div className="template-section">
          <h3>{locale === 'zh' ? '预设模板' : 'Preset Templates'}</h3>
          <div className="template-list">
            {templateList.map((template) => (
              <div key={template.key} className="template-row">
                <div className="template-row-info">
                  <span className="template-card-icon">{template.icon}</span>
                  <div className="template-row-text">
                    <h4>{locale === 'zh' ? template.name : template.nameEn}</h4>
                    <p className="template-card-desc">
                      {locale === 'zh' ? template.desc : template.descEn}
                    </p>
                  </div>
                </div>
                <div className="template-row-actions">
                  <button 
                    className="btn btn-primary template-select-btn"
                    onClick={() => selectPresetTemplate(template.key)}
                  >
                    {locale === 'zh' ? '选择' : 'Select'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 自定义模板 */}
        {customTemplates.length > 0 && (
          <div className="template-section">
            <h3>{locale === 'zh' ? '自定义模板' : 'Custom Templates'}</h3>
            <div className="template-list">
              {customTemplates.map((template) => (
                <div key={template.id} className="template-row">
                  <div className="template-row-info">
                    <span className="template-card-icon">⚙️</span>
                    <div className="template-row-text">
                      <h4>{template.name}</h4>
                      <p className="template-card-desc">
                        {locale === 'zh' ? '创建于' : 'Created'} {new Date(template.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="template-row-actions">
                    <button 
                      className="btn btn-primary template-select-btn"
                      onClick={() => applyTemplate(template.id)}
                    >
                      {locale === 'zh' ? '选择' : 'Select'}
                    </button>
                    <button 
                      className="btn btn-ghost template-delete-btn"
                      onClick={() => deleteTemplate(template.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};