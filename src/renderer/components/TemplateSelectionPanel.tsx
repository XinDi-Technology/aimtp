import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { useAppStore, clearAllCustomTemplates } from '../store/useAppStore';
import { useI18n } from '../hooks';

export const TemplateSelectionPanel: FC = () => {
  const { 
    customTemplates, 
    selectPresetTemplate, 
    applyTemplate, 
    deleteTemplate
  } = useAppStore();
  const { t } = useI18n();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [templatesDir, setTemplatesDir] = useState('');

  const hasTemplateApi = !!window.electronAPI?.templates;

  // 自定义模板以 JSON 文件的形式存放在 userData/templates，目录路径展示给用户，
  // 方便备份与迁移（卸载程序不会删除该目录）。
  useEffect(() => {
    let cancelled = false;
    window.electronAPI?.templates
      ?.dir()
      .then((dir) => {
        if (!cancelled) setTemplatesDir(dir);
      })
      .catch(() => { /* 取不到目录就不展示路径 */ });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenTemplateDir = () => {
    void window.electronAPI?.templates?.openDir().catch(() => { /* 打开失败静默处理 */ });
  };

  const handleClearPersonalData = async () => {
    setShowClearConfirm(false);
    await clearAllCustomTemplates();
    useAppStore.setState({ customTemplates: [] });
    try {
      localStorage.removeItem('aimtp-app-storage');
    } catch { /* 清理失败不阻断 */ }
    window.location.reload();
  };

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

        {/* 数据与目录 */}
        <div className="template-section">
          <h3>{t.templatePanel.dataAndDir}</h3>
          <div className="template-list">
            <button
              className="btn btn-ghost"
              style={{ width: '100%', marginTop: '8px' }}
              onClick={handleOpenTemplateDir}
              disabled={!hasTemplateApi}
              data-testid="open-template-dir-btn"
            >
              📂 {t.settings.actions.openTemplateDir}
            </button>

            {templatesDir && (
              <p style={{ color: '#666', fontSize: '12px', marginTop: '6px', wordBreak: 'break-all' }}>
                {t.settings.actions.templateDirPrefix}{templatesDir}
              </p>
            )}

            <button
              className="btn btn-ghost"
              style={{ width: '100%', marginTop: '8px' }}
              onClick={() => setShowClearConfirm(true)}
              disabled={!hasTemplateApi}
              data-testid="clear-personal-data-btn"
            >
              🗑️ {t.settings.actions.clearPersonalData}
            </button>
          </div>
        </div>
      </div>

      {/* 清除个人数据确认弹窗 */}
      {showClearConfirm && (
        <div className="modal-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{t.settings.modal.clearDataTitle}</h3>
            <p style={{ fontSize: '13px', lineHeight: 1.6 }}>
              {t.settings.modal.clearDataMessage}{templatesDir ? `（${templatesDir}）` : ''}{t.settings.modal.clearDataMessageSuffix}
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowClearConfirm(false)}>
                {t.settings.modal.cancel}
              </button>
              <button className="btn btn-primary" onClick={handleClearPersonalData}>
                {t.settings.modal.confirmClear}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
