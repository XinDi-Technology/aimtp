import type { FC } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useI18n } from '../hooks';

export const TemplateSelectionPanel: FC = () => {
  const { 
    customTemplates, 
    selectPresetTemplate, 
    applyTemplate, 
    deleteTemplate
  } = useAppStore();
  const { t } = useI18n();

  const templateList = [
    {
      key: 'zhTech',
      name: t.templatePanel.zhTechName,
      icon: '📘',
      desc: t.templatePanel.zhTechDesc,
    },
  ];

  return (
    <div className="template-selection-inline-panel">
      <div className="template-selection-content">
        {/* 预设模板 */}
        <div className="template-section">
          <h3>{t.templatePanel.preset}</h3>
          <div className="template-list">
            {templateList.map((template) => (
              <div key={template.key} className="template-row">
                <div className="template-row-info">
                  <span className="template-card-icon">{template.icon}</span>
                  <div className="template-row-text">
                    <h4>{template.name}</h4>
                    <p className="template-card-desc">
                      {template.desc}
                    </p>
                  </div>
                </div>
                <div className="template-row-actions">
                  <button 
                    className="btn btn-primary template-select-btn"
                    onClick={() => selectPresetTemplate(template.key)}
                  >
                    {t.templatePanel.select}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 自定义模板 */}
        {customTemplates.length > 0 && (
          <div className="template-section">
            <h3>{t.templatePanel.custom}</h3>
            <div className="template-list">
              {customTemplates.map((template) => (
                <div key={template.id} className="template-row">
                  <div className="template-row-info">
                    <span className="template-card-icon">⚙️</span>
                    <div className="template-row-text">
                      <h4>{template.name}</h4>
                      <p className="template-card-desc">
                        {t.templatePanel.createdAt} {new Date(template.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="template-row-actions">
                    <button 
                      className="btn btn-primary template-select-btn"
                      onClick={() => applyTemplate(template.id)}
                    >
                      {t.templatePanel.select}
                    </button>
                    <button 
                      className="btn btn-ghost template-delete-btn"
                      onClick={() => deleteTemplate(template.id)}
                      aria-label={t.templatePanel.delete}
                      title={t.templatePanel.delete}
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
