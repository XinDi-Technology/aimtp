import React, { useEffect, useState } from 'react';
import { clearAllCustomTemplates, useAppStore, PageSettings } from '../store/useAppStore';
import { useI18n } from '../hooks';

export const SettingsPanel: React.FC = () => {
  const { page, setPage, font, setFont, extensions, setExtensions, headerFooter, setHeaderFooter, cover, setCover, saveAsTemplate, preview, setPreview } = useAppStore();
  const { t } = useI18n();
  const [showModal, setShowModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [templatesDir, setTemplatesDir] = useState('');

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

  const hasTemplateApi = !!window.electronAPI?.templates;

  const handleSaveTemplate = () => {
    if (templateName.trim()) {
      saveAsTemplate(templateName.trim());
      setTemplateName('');
      setShowModal(false);
    }
  };

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

  return (
    <div className="settings-panel" data-testid="settings-panel">
      <div className="settings-panel-scroll" data-testid="settings-panel-scroll">
        <h2>⚙️ {t.settings.title}</h2>

        <div className="setting-section" data-testid="page-settings">
          <h3>{t.settings.page.title}</h3>

          <div className="setting-group setting-group-inline">
            <label className="setting-label">{t.settings.page.size}</label>
            <select
              className="setting-input setting-select setting-input-compact"
              data-testid="page-size-select"
              value={page.size}
              onChange={(e) => setPage({ size: e.target.value as PageSettings['size'] })}
            >
              <option value="A4">A4</option>
              <option value="A3">A3</option>
            </select>
          </div>

          <div className="setting-group setting-group-inline">
            <label className="setting-label">{t.settings.page.orientation}</label>
            <select
              className="setting-input setting-select setting-input-compact"
              value={page.orientation}
              onChange={(e) => setPage({ orientation: e.target.value as PageSettings['orientation'] })}
            >
              <option value="portrait">{t.settings.page.orientationPortrait}</option>
              <option value="landscape">{t.settings.page.orientationLandscape}</option>
            </select>
          </div>

          <div className="setting-group">
            <label className="setting-label">{t.settings.page.margins}</label>
            <div className="margin-controls-vertical">
              <div className="margin-item">
                <span className="margin-label">{t.settings.page.marginTop}</span>
                <input
                  type="number"
                  className="setting-input setting-input-compact"
                  value={page.margins.top}
                  min="1"
                  max="50"
                  onChange={(e) => {
                    const value = Math.min(50, Math.max(1, Number(e.target.value)));
                    setPage({ margins: { ...page.margins, top: value } });
                  }}
                />
              </div>
              <div className="margin-item">
                <span className="margin-label">{t.settings.page.marginBottom}</span>
                <input
                  type="number"
                  className="setting-input setting-input-compact"
                  value={page.margins.bottom}
                  min="1"
                  max="50"
                  onChange={(e) => {
                    const value = Math.min(50, Math.max(1, Number(e.target.value)));
                    setPage({ margins: { ...page.margins, bottom: value } });
                  }}
                />
              </div>
              <div className="margin-item">
                <span className="margin-label">{t.settings.page.marginLeft}</span>
                <input
                  type="number"
                  className="setting-input setting-input-compact"
                  value={page.margins.left}
                  min="1"
                  max="50"
                  onChange={(e) => {
                    const value = Math.min(50, Math.max(1, Number(e.target.value)));
                    setPage({ margins: { ...page.margins, left: value } });
                  }}
                />
              </div>
              <div className="margin-item">
                <span className="margin-label">{t.settings.page.marginRight}</span>
                <input
                  type="number"
                  className="setting-input setting-input-compact"
                  value={page.margins.right}
                  min="1"
                  max="50"
                  onChange={(e) => {
                    const value = Math.min(50, Math.max(1, Number(e.target.value)));
                    setPage({ margins: { ...page.margins, right: value } });
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="setting-section">
          <h3>{t.settings.font.title}</h3>

          <div className="setting-group">
            <label className="setting-label">{t.settings.font.body}</label>
            <select
              className="setting-input setting-select"
              value={font.body}
              onChange={(e) => setFont({ body: e.target.value })}
            >
              <option value="GWM Sans UI">GWM Sans UI</option>
            </select>
          </div>

          <div className="setting-group">
            <label className="setting-label">{t.settings.font.code}</label>
            <select
              className="setting-input setting-select"
              value={font.code}
              onChange={(e) => setFont({ code: e.target.value })}
            >
              <option value="JetBrains Mono">JetBrains Mono</option>
              <option value="Monaspace Argon">Monaspace Argon</option>
            </select>
          </div>

          <div className="setting-group setting-group-inline">
            <label className="setting-label">{t.settings.font.baseSize}</label>
            <input
              type="number"
              className="setting-input setting-input-compact"
              value={font.baseSize}
              min="8"
              max="72"
              onChange={(e) => setFont({ baseSize: Number(e.target.value) })}
            />
          </div>

          <div className="setting-group setting-group-inline">
            <label className="setting-label">{t.settings.font.lineHeight}</label>
            <input
              type="number"
              className="setting-input setting-input-compact"
              value={font.lineHeight}
              step="0.1"
              min="0.8"
              max="3"
              onChange={(e) => setFont({ lineHeight: Number(e.target.value) })}
            />
          </div>

          <div className="setting-group setting-group-inline">
            <label className="setting-label">{t.settings.font.paragraphSpacing}</label>
            <input
              type="number"
              className="setting-input setting-input-compact"
              value={font.paragraphSpacing}
              step="0.1"
              min="0"
              max="3"
              onChange={(e) => setFont({ paragraphSpacing: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="setting-section">
          <h3>{t.settings.extensions.title}</h3>

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={extensions.githubAlerts}
                onChange={(e) => setExtensions({ githubAlerts: e.target.checked })}
              />
              {t.settings.extensions.githubAlerts}
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={extensions.codeHighlight}
                onChange={(e) => setExtensions({ codeHighlight: e.target.checked })}
              />
              {t.settings.extensions.codeHighlight}
            </label>
          </div>

          {extensions.codeHighlight && (
            <div className="setting-group">
              <label className="setting-label">{t.settings.extensions.codeTheme}</label>
              <select
                className="setting-input setting-select"
                value={extensions.codeTheme}
                onChange={(e) => setExtensions({ codeTheme: e.target.value })}
              >
                <option value="github">GitHub</option>
                <option value="monokai">Monokai</option>
                <option value="dracula">Dracula</option>
              </select>
            </div>
          )}

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={extensions.taskLists}
                onChange={(e) => setExtensions({ taskLists: e.target.checked })}
              />
              {t.settings.extensions.taskLists}
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={extensions.footnotes}
                onChange={(e) => setExtensions({ footnotes: e.target.checked })}
              />
              {t.settings.extensions.footnotes}
            </label>
          </div>

          {extensions.footnotes && (
            <div className="setting-group">
              <label className="setting-label">{t.settings.extensions.footnotePosition}</label>
              <select
                className="setting-input setting-select"
                value={extensions.footnoteMode}
                onChange={(e) => setExtensions({ footnoteMode: e.target.value as 'end' | 'page-bottom' })}
              >
                <option value="end">{t.settings.extensions.footnoteEnd}</option>
                <option value="page-bottom">{t.settings.extensions.footnotePageBottom}</option>
              </select>
            </div>
          )}

          <div className="setting-group">
            <label className="setting-label" style={{ marginBottom: '8px', display: 'block' }}>{t.settings.extensions.pageBreak}</label>
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={extensions.h1PageBreak}
                onChange={(e) => setExtensions({ h1PageBreak: e.target.checked })}
              />
              {t.settings.extensions.h1PageBreak}
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={extensions.h2PageBreak}
                onChange={(e) => setExtensions({ h2PageBreak: e.target.checked })}
              />
              {t.settings.extensions.h2PageBreak}
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={extensions.showLineNumbers}
                onChange={(e) => setExtensions({ showLineNumbers: e.target.checked })}
              />
              {t.settings.extensions.showLineNumbers}
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={extensions.mermaid}
                onChange={(e) => setExtensions({ mermaid: e.target.checked })}
              />
              {t.settings.extensions.mermaid}
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={extensions.mathJax}
                onChange={(e) => setExtensions({ mathJax: e.target.checked })}
              />
              {t.settings.extensions.mathJax}
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={extensions.mark}
                onChange={(e) => setExtensions({ mark: e.target.checked })}
              />
              {t.settings.extensions.mark}
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={extensions.ins}
                onChange={(e) => setExtensions({ ins: e.target.checked })}
              />
              {t.settings.extensions.ins}
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={extensions.sub}
                onChange={(e) => setExtensions({ sub: e.target.checked })}
              />
              {t.settings.extensions.sub}
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={extensions.sup}
                onChange={(e) => setExtensions({ sup: e.target.checked })}
              />
              {t.settings.extensions.sup}
            </label>
          </div>
        </div>

        <div className="setting-section">
          <h3>{t.settings.frontMatter.title}</h3>

          <div className="setting-hint" style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
            {t.settings.frontMatter.hint}
            <pre style={{ background: '#f5f5f5', padding: '8px', borderRadius: '4px', marginTop: '4px', fontSize: '11px' }}>
{`---
title: 文档标题
author: 作者名
date: 2024-01-01
---`}
            </pre>
          </div>
        </div>

        <div className="setting-section">
          <h3>{t.settings.cover.title}</h3>

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={cover.enabled}
                onChange={(e) => setCover({ enabled: e.target.checked })}
              />
              {t.settings.cover.enabled}
            </label>
          </div>
        </div>

        <div className="setting-section">
          <h3>{t.settings.headerFooter.title}</h3>

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={headerFooter.enabled}
                onChange={(e) => setHeaderFooter({ enabled: e.target.checked })}
              />
              {t.settings.headerFooter.enabled}
            </label>
          </div>

          {headerFooter.enabled && (
            <>
              {/* 页眉设置 */}
              <div className="setting-subsection">
                <h4>{t.settings.headerFooter.headerSettings}</h4>

                <div className="setting-group">
                  <label className="setting-label">{t.settings.headerFooter.font}</label>
                  <select
                    className="setting-input setting-select"
                    value={headerFooter.header.font}
                    onChange={(e) => setHeaderFooter({
                      header: {
                        ...headerFooter.header,
                        font: e.target.value
                      }
                    })}
                  >
                    <option value="GWM Sans UI">GWM Sans UI</option>
                  </select>
                </div>

                <div className="setting-group">
                  <label className="setting-label">{t.settings.headerFooter.alignment}</label>
                  <select
                    className="setting-input setting-select"
                    value={headerFooter.header.alignment}
                    onChange={(e) => setHeaderFooter({
                      header: {
                        ...headerFooter.header,
                        alignment: e.target.value as 'left' | 'center' | 'right'
                      }
                    })}
                  >
                    <option value="left">{t.settings.headerFooter.alignLeft}</option>
                    <option value="center">{t.settings.headerFooter.alignCenter}</option>
                    <option value="right">{t.settings.headerFooter.alignRight}</option>
                  </select>
                </div>

                <div className="setting-group">
                  <label className="setting-label">{t.settings.headerFooter.content}</label>
                  <select
                    className="setting-input setting-select"
                    value={headerFooter.header.content}
                    onChange={(e) => setHeaderFooter({
                      header: {
                        ...headerFooter.header,
                        content: e.target.value
                      }
                    })}
                  >
                    <option value="title">{t.settings.headerFooter.contentTitle}</option>
                    <option value="author">{t.settings.headerFooter.contentAuthor}</option>
                    <option value="date">{t.settings.headerFooter.contentDate}</option>
                    <option value="">{t.settings.headerFooter.contentNone}</option>
                  </select>
                </div>
              </div>

              {/* 页脚设置 */}
              <div className="setting-subsection">
                <h4>{t.settings.headerFooter.footerSettings}</h4>

                <div className="setting-group">
                  <label className="setting-label">{t.settings.headerFooter.font}</label>
                  <select
                    className="setting-input setting-select"
                    value={headerFooter.footer.font}
                    onChange={(e) => setHeaderFooter({
                      footer: {
                        ...headerFooter.footer,
                        font: e.target.value
                      }
                    })}
                  >
                    <option value="GWM Sans UI">GWM Sans UI</option>
                  </select>
                </div>

                <div className="setting-group">
                  <label className="setting-label">{t.settings.headerFooter.alignment}</label>
                  <select
                    className="setting-input setting-select"
                    value={headerFooter.footer.alignment}
                    onChange={(e) => setHeaderFooter({
                      footer: {
                        ...headerFooter.footer,
                        alignment: e.target.value as 'left' | 'center' | 'right'
                      }
                    })}
                  >
                    <option value="left">{t.settings.headerFooter.alignLeft}</option>
                    <option value="center">{t.settings.headerFooter.alignCenter}</option>
                    <option value="right">{t.settings.headerFooter.alignRight}</option>
                  </select>
                </div>

                <div className="setting-group">
                  <label className="setting-label">{t.settings.headerFooter.content}</label>
                  <select
                    className="setting-input setting-select"
                    value={headerFooter.footer.content}
                    onChange={(e) => setHeaderFooter({
                      footer: {
                        ...headerFooter.footer,
                        content: e.target.value
                      }
                    })}
                  >
                    <option value="pageNumber">{t.settings.headerFooter.contentPageNumber}</option>
                    <option value="pageNumberTotal">{t.settings.headerFooter.contentPageNumberTotal}</option>
                    <option value="title">{t.settings.headerFooter.contentTitle}</option>
                    <option value="author">{t.settings.headerFooter.contentAuthor}</option>
                    <option value="date">{t.settings.headerFooter.contentDate}</option>
                    <option value="">{t.settings.headerFooter.contentNone}</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="setting-section">
          <h3>{t.settings.preview.title}</h3>

          <div className="setting-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                className="setting-input"
                min="48"
                max="480"
                value={preview.targetDPI}
                onChange={(e) => setPreview({ targetDPI: parseInt(e.target.value) || 96 })}
                style={{ width: '80px' }}
                data-testid="dpi-input"
              />
              <span style={{ color: '#666', fontSize: '14px' }}>{t.settings.preview.dpi}</span>
            </div>
          </div>
        </div>

        <div className="setting-section">
          <button
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: '8px' }}
            onClick={() => setShowModal(true)}
          >
            💾 {t.settings.actions.saveAsTemplate}
          </button>

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

      {/* 模板名称输入弹窗 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{t.settings.modal.saveTemplateTitle}</h3>
            <div className="setting-group">
              <label className="setting-label">{t.settings.modal.templateName}</label>
              <input
                type="text"
                className="setting-input"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={t.settings.modal.templateNamePlaceholder}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveTemplate();
                  } else if (e.key === 'Escape') {
                    setShowModal(false);
                  }
                }}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>
                {t.settings.modal.cancel}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveTemplate}
                disabled={!templateName.trim()}
              >
                {t.settings.modal.save}
              </button>
            </div>
          </div>
        </div>
      )}

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
