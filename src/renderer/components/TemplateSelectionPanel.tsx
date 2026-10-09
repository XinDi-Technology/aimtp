import type { FC } from 'react';
import { useAppStore } from '../store/useAppStore';

const templateList = [
  {
    key: 'zhTech',
    name: '中文技术文档',
    nameEn: 'Chinese Technical Doc',
    icon: '📘',
    desc: '含设置说明与排版示例，默认 A4 / 18px / 行高 2',
    descEn: 'With settings notes and typography samples, A4 / 18px / line-height 2',
  },
];

export const TemplateSelectionPanel: FC = () => {
  const { 
    locale, 
    customTemplates, 
    selectPresetTemplate, 
    applyTemplate, 
    deleteTemplate
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