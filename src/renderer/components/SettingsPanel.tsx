import React, { useState } from 'react';
import { useAppStore, PageSettings } from '../store/useAppStore';
import './styles.css';

export const SettingsPanel: React.FC = () => {
  const { page, setPage, font, setFont, extensions, setExtensions, headerFooter, setHeaderFooter, cover, setCover, saveAsTemplate, preview, setPreview, locale } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const handleSaveTemplate = () => {
    if (templateName.trim()) {
      saveAsTemplate(templateName.trim());
      setTemplateName('');
      setShowModal(false);
    }
  };

  return (
    <aside className="settings-panel" data-testid="settings-panel">
      <h2>⚙️ 设置</h2>

      <div className="setting-section" data-testid="page-settings">
        <h3>页面设置</h3>
        
        <div className="setting-group">
          <label className="setting-label">页面尺寸</label>
          <select
            className="setting-input setting-select"
            data-testid="page-size-select"
            value={page.size}
            onChange={(e) => setPage({ size: e.target.value as PageSettings['size'] })}
          >
            <option value="A4">A4 (默认)</option>
            <option value="A3">A3</option>
          </select>
        </div>

        <div className="setting-group">
          <label className="setting-label">页面方向</label>
          <select
            className="setting-input setting-select"
            value={page.orientation}
            onChange={(e) => setPage({ orientation: e.target.value as PageSettings['orientation'] })}
          >
            <option value="portrait">纵向</option>
            <option value="landscape">横向</option>
          </select>
        </div>

        <div className="setting-group">
          <label className="setting-label">边距 (mm)</label>
          <div className="margin-controls-vertical">
            <div className="margin-item">
              <span className="margin-label">上</span>
              <input
                type="number"
                className="setting-input margin-input"
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
              <span className="margin-label">下</span>
              <input
                type="number"
                className="setting-input margin-input"
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
              <span className="margin-label">左</span>
              <input
                type="number"
                className="setting-input margin-input"
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
              <span className="margin-label">右</span>
              <input
                type="number"
                className="setting-input margin-input"
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
        <h3>字体设置</h3>
        
        <div className="setting-group">
          <label className="setting-label">正文字体</label>
          <select
            className="setting-input setting-select"
            value={font.body}
            onChange={(e) => setFont({ body: e.target.value })}
          >
            <option value="GWM Sans UI">GWM Sans UI</option>
          </select>
        </div>

        <div className="setting-group">
          <label className="setting-label">标题字体</label>
          <select
            className="setting-input setting-select"
            value={font.heading}
            onChange={(e) => setFont({ heading: e.target.value })}
          >
            <option value="GWM Sans UI">GWM Sans UI</option>
          </select>
        </div>

        <div className="setting-group">
          <label className="setting-label">代码字体</label>
          <select
            className="setting-input setting-select"
            value={font.code}
            onChange={(e) => setFont({ code: e.target.value })}
          >
            <option value="JetBrains Mono">JetBrains Mono</option>
            <option value="Monaspace Argon">Monaspace Argon</option>
          </select>
        </div>

        <div className="setting-group">
          <label className="setting-label">基础字号</label>
          <input
            type="number"
            className="setting-input"
            value={font.baseSize}
            min="8"
            max="72"
            onChange={(e) => setFont({ baseSize: Number(e.target.value) })}
          />
        </div>

        <div className="setting-group">
          <label className="setting-label">行高</label>
          <input
            type="number"
            className="setting-input"
            value={font.lineHeight}
            step="0.1"
            min="0.8"
            max="3"
            onChange={(e) => setFont({ lineHeight: Number(e.target.value) })}
          />
        </div>

        <div className="setting-group">
          <label className="setting-label">标题缩放系数</label>
          <input
            type="number"
            className="setting-input"
            value={font.headingScale}
            step="0.1"
            min="1.0"
            max="2.0"
            onChange={(e) => setFont({ headingScale: Number(e.target.value) })}
          />
          <small style={{ color: '#999', fontSize: '12px' }}>范围: 1.0-2.0，默认 1.2（越大标题层次越明显）</small>
        </div>
      </div>

      <div className="setting-section">
        <h3>扩展功能</h3>
        
        <div className="setting-group">
          <label className="setting-checkbox">
            <input
              type="checkbox"
              checked={extensions.githubAlerts}
              onChange={(e) => setExtensions({ githubAlerts: e.target.checked })}
            />
            启用 GitHub 风格警告框
          </label>
        </div>

        <div className="setting-group">
          <label className="setting-checkbox">
            <input
              type="checkbox"
              checked={extensions.codeHighlight}
              onChange={(e) => setExtensions({ codeHighlight: e.target.checked })}
            />
            启用代码高亮
          </label>
        </div>

        {extensions.codeHighlight && (
          <div className="setting-group">
            <label className="setting-label">代码高亮主题</label>
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
            启用待办事项
          </label>
        </div>

        <div className="setting-group">
          <label className="setting-checkbox">
            <input
              type="checkbox"
              checked={extensions.footnotes}
              onChange={(e) => setExtensions({ footnotes: e.target.checked })}
            />
            启用脚注
          </label>
        </div>

        <div className="setting-group">
          <label className="setting-checkbox">
            <input
              type="checkbox"
              checked={extensions.showLineNumbers}
              onChange={(e) => setExtensions({ showLineNumbers: e.target.checked })}
            />
            显示代码行号
          </label>
        </div>

        <div className="setting-group">
          <label className="setting-checkbox">
            <input
              type="checkbox"
              checked={extensions.mermaid}
              onChange={(e) => setExtensions({ mermaid: e.target.checked })}
            />
            启用 Mermaid 图表
          </label>
        </div>

        <div className="setting-group">
          <label className="setting-checkbox">
            <input
              type="checkbox"
              checked={extensions.mathJax}
              onChange={(e) => setExtensions({ mathJax: e.target.checked })}
            />
            启用 MathJax 数学公式
          </label>
        </div>

        <div className="setting-group">
          <label className="setting-checkbox">
            <input
              type="checkbox"
              checked={extensions.mark}
              onChange={(e) => setExtensions({ mark: e.target.checked })}
            />
            启用高亮标记 (==text==)
          </label>
        </div>

        <div className="setting-group">
          <label className="setting-checkbox">
            <input
              type="checkbox"
              checked={extensions.ins}
              onChange={(e) => setExtensions({ ins: e.target.checked })}
            />
            启用下划线插入 (++text++)
          </label>
        </div>

        <div className="setting-group">
          <label className="setting-checkbox">
            <input
              type="checkbox"
              checked={extensions.sub}
              onChange={(e) => setExtensions({ sub: e.target.checked })}
            />
            启用下标 (H~2~O)
          </label>
        </div>

        <div className="setting-group">
          <label className="setting-checkbox">
            <input
              type="checkbox"
              checked={extensions.sup}
              onChange={(e) => setExtensions({ sup: e.target.checked })}
            />
            启用上标 (E=mc^2^)
          </label>
        </div>


      </div>

      <div className="setting-section">
        <h3>封面设置</h3>
        
        <div className="setting-group">
          <label className="setting-checkbox">
            <input
              type="checkbox"
              checked={cover.enabled}
              onChange={(e) => setCover({ enabled: e.target.checked })}
            />
            启用封面（从 YAML Front Matter 自动提取元数据）
          </label>
        </div>
        
        {cover.enabled && (
          <div className="setting-hint" style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
            💡 提示：在 Markdown 文件开头添加以下格式：
            <pre style={{ background: '#f5f5f5', padding: '8px', borderRadius: '4px', marginTop: '4px', fontSize: '11px' }}>
{`---
title: 文档标题
author: 作者名
date: 2024-01-01
---`}
            </pre>
          </div>
        )}
      </div>

      <div className="setting-section">
        <h3>页眉页脚</h3>
        
        <div className="setting-group">
          <label className="setting-checkbox">
            <input
              type="checkbox"
              checked={headerFooter.enabled}
              onChange={(e) => setHeaderFooter({ enabled: e.target.checked })}
            />
            启用页眉页脚
          </label>
        </div>

        {headerFooter.enabled && (
          <>
            {/* 页眉设置 */}
            <div className="setting-subsection">
              <h4>页眉设置</h4>
              
              <div className="setting-group">
                <label className="setting-label">字体</label>
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
                <label className="setting-label">对齐方式</label>
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
                  <option value="left">左对齐</option>
                  <option value="center">居中</option>
                  <option value="right">右对齐</option>
                </select>
              </div>

              <div className="setting-group">
                <label className="setting-label">内容</label>
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
                  <option value="title">标题（从 YAML 提取）</option>
                  <option value="author">作者（从 YAML 提取）</option>
                  <option value="date">日期（从 YAML 提取）</option>
                  <option value="">不显示</option>
                </select>
              </div>
              
              <div className="setting-hint" style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                💡 提示：在 Markdown 文件开头添加 YAML Front Matter
              </div>
            </div>

            {/* 页脚设置 */}
            <div className="setting-subsection">
              <h4>页脚设置</h4>
              
              <div className="setting-group">
                <label className="setting-label">字体</label>
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
                <label className="setting-label">对齐方式</label>
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
                  <option value="left">左对齐</option>
                  <option value="center">居中</option>
                  <option value="right">右对齐</option>
                </select>
              </div>

              <div className="setting-group">
                <label className="setting-label">内容</label>
                <select
                  className="setting-input setting-select"
                  value={headerFooter.footer.content === 'pageNumber' ? 'pageNumber' : headerFooter.footer.content === 'pageNumberTotal' ? 'pageNumberTotal' : headerFooter.footer.content}
                  onChange={(e) => {
                    const val = e.target.value;
                    setHeaderFooter({ 
                      footer: { 
                        ...headerFooter.footer, 
                        content: val
                      } 
                    });
                  }}
                >
                  <option value="pageNumber">页码</option>
                  <option value="pageNumberTotal">第x页/共x页</option>
                  <option value="title">标题（从 YAML 提取）</option>
                  <option value="author">作者（从 YAML 提取）</option>
                  <option value="date">日期（从 YAML 提取）</option>
                  <option value="">不显示</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="setting-section">
        <h3>预览校准</h3>
        
        <div className="setting-group">
          <label className="setting-label">
            {locale === 'zh' ? '缩放校准' : 'Zoom Calibration'}
            <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>
              {Math.round(preview.calibration * 100)}%
            </span>
          </label>
          <input
            type="range"
            className="setting-input"
            min="0.9"
            max="1.1"
            step="0.01"
            value={preview.calibration}
            onChange={(e) => setPreview({ calibration: parseFloat(e.target.value) })}
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
            {locale === 'zh' 
              ? '调整此值使预览中的 A4 纸与实际 A4 纸大小一致' 
              : 'Adjust so that the preview matches the actual A4 paper size'}
          </div>
        </div>
        
        <button
          className="btn btn-secondary"
          style={{ width: '100%', marginTop: '8px' }}
          onClick={() => setPreview({ calibration: 1.0 })}
        >
          🔄 重置为默认
        </button>
      </div>

      <div className="setting-section">
        <button
          className="btn btn-secondary"
          style={{ width: '100%', marginTop: '8px' }}
          onClick={() => setShowModal(true)}
        >
          💾 保存设置为模板
        </button>
      </div>

      {/* 模板名称输入弹窗 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>保存设置为模板</h3>
            <div className="setting-group">
              <label className="setting-label">模板名称</label>
              <input
                type="text"
                className="setting-input"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="请输入模板名称"
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
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveTemplate}
                disabled={!templateName.trim()}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};