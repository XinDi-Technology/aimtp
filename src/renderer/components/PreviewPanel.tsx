/**
 * PreviewPanel — 预览面板组件
 *
 * 迭代3重构：集成 PreviewOrchestrator，实现三分支预览流程：
 * - visual-only: CSS 实时反射，无 Loading 遮罩，~56ms 响应
 * - layout-change: 重新分页，显示 Loading
 * - content-change: 完整重新渲染，显示 Loading
 *
 * 字体/行高滑块调整走 visual-only 路径（无闪烁），
 * 释放滑块后自动触发一次完整渲染修正分页。
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { SettingChangeCategory, HeaderFooterSettings } from '../store/useAppStore';
import { generateHtml } from '../utils/htmlGenerator';
import { PagedJsAdapter, LayoutProgressCallback } from '../domain/PagedJsAdapter';
import { layoutDOMManager } from '../domain/LayoutDOMManager';
import { PreviewOrchestrator } from '../orchestration/PreviewOrchestrator';
import type { RenderContext } from '../orchestration/PreviewOrchestrator';
import {
  classifySettingChange,
  createSettingsSnapshot,
} from '../orchestration/SettingChangeClassifier';
import type { AppSettingsSnapshot } from '../orchestration/SettingChangeClassifier';
import type { HeaderFooterConfig, FrontMatter } from '../domain/handlers/AimtpHandler';

const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  overflow: 'auto',
  position: 'relative',
  backgroundColor: '#9ca3af',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '20px 0',
};

const frameWrapperStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  minHeight: '100%',
  border: 'none',
  backgroundColor: 'transparent',
  overflow: 'hidden',
};

const loadingOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(82, 86, 89, 0.8)',
  zIndex: 10,
  color: '#fff',
  fontSize: '16px',
  flexDirection: 'column',
  gap: '8px',
};

/** visual-only 更新后，延迟完整渲染修正分页的等待时间 */
const VISUAL_CORRECTION_DELAY = 500;

let renderIdCounter = 0;
const pagedJsAdapter = new PagedJsAdapter();

interface PreviewPanelProps {
  className?: string;
}

const PreviewPanel: React.FC<PreviewPanelProps> = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const renderIdRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visualCorrectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSettingsRef = useRef<AppSettingsSnapshot | null>(null);
  const prevTemplateRef = useRef<string>('');
  const needsCorrectionRef = useRef(false);
  const doFullRenderRef = useRef<() => void>(() => {});

  const [loading, setLoading] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [pendingCategory, setPendingCategory] = useState<SettingChangeCategory | null>(null);

  // PreviewOrchestrator 实例（每个组件一个）
  const orchestratorRef = useRef<PreviewOrchestrator | null>(null);

  const markdown = useAppStore((s) => s.markdown);
  const page = useAppStore((s) => s.page);
  const font = useAppStore((s) => s.font);
  const extensions = useAppStore((s) => s.extensions);
  const cover = useAppStore((s) => s.cover);
  const headerFooter = useAppStore((s) => s.headerFooter);
  const locale = useAppStore((s) => s.locale);
  const currentTemplate = useAppStore((s) => s.currentTemplate);
  const isGenerating = useAppStore((s) => s.isGenerating);
  const setLayoutDOM = useAppStore((s) => s.setLayoutDOM);
  const setSettingChangeCategory = useAppStore((s) => s.setSettingChangeCategory);

  const lastRenderResultRef = useRef<{
    html: string;
    totalPages: number;
  } | null>(null);

  // 创建/获取当前设置快照
  const currentSnapshot = useCallback((): AppSettingsSnapshot => {
    return createSettingsSnapshot({ page, font, cover, headerFooter });
  }, [page, font, cover, headerFooter]);

  // Set up progress callback on the adapter
  useEffect(() => {
    const callback: LayoutProgressCallback = (phase, detail) => {
      switch (phase) {
        case 'fonts':
          setProgressText('加载字体...');
          break;
        case 'document':
          setProgressText('准备文档...');
          break;
        case 'injecting':
          setProgressText('注入排版引擎...');
          break;
        case 'rendering':
          setProgressText('分页渲染中...');
          break;
        case 'page':
          if (detail?.current && detail?.total) {
            setProgressText(`分页中 ${detail.current}/${detail.total}...`);
          }
          break;
        case 'done':
          setProgressText('');
          break;
      }
    };

    pagedJsAdapter.onProgress(callback);

    return () => {
      pagedJsAdapter.onProgress(null as unknown as LayoutProgressCallback);
    };
  }, []);

  const ensureFrameReady = useCallback((frame: HTMLIFrameElement): Promise<Document> => {
    return new Promise((resolve, reject) => {
      const doc = frame.contentDocument;
      if (doc && doc.readyState === 'complete') {
        resolve(doc);
        return;
      }

      const timeout = setTimeout(() => {
        if (frame.contentDocument) {
          resolve(frame.contentDocument);
        } else {
          reject(new Error('iframe timeout'));
        }
      }, 5000);

      const handler = () => {
        clearTimeout(timeout);
        resolve(frame.contentDocument!);
      };

      frame.addEventListener('load', handler, { once: true });
    });
  }, []);

  /** 完整渲染（content-change 路径或修正分页） */
  const doFullRender = useCallback(async () => {
    const currentRenderId = ++renderIdCounter;
    renderIdRef.current = currentRenderId;
    setLoading(true);

    try {
      const html = await generateHtml({
        markdown, locale, page, font, extensions, cover, headerFooter,
      });

      if (renderIdRef.current !== currentRenderId) { setLoading(false); return; }

      const frame = frameRef.current;
      if (!frame) { setLoading(false); return; }

      try {
        await ensureFrameReady(frame);
      } catch {
        setLoading(false);
        return;
      }

      if (renderIdRef.current !== currentRenderId) { setLoading(false); return; }

      const sourceHash = layoutDOMManager['hashContent'](markdown);

      // F0: 在 layout 前设置页眉页脚配置
      pagedJsAdapter.setHeaderFooterConfig(
        buildHeaderFooterConfig(headerFooter),
        extractFrontMatter(markdown),
      );

      const layoutDOM = await pagedJsAdapter.layout(html, frame, sourceHash);

      if (renderIdRef.current !== currentRenderId) { setLoading(false); return; }

      layoutDOMManager.update(layoutDOM);
      setLayoutDOM(layoutDOM);

      const renderedHtml = layoutDOM.document.documentElement.outerHTML;
      lastRenderResultRef.current = { html: renderedHtml, totalPages: layoutDOM.metadata.totalPages };

      setPageCount(layoutDOM.metadata.totalPages);
      setLoading(false);
    } catch (err) {
      console.error('[Aimtp] Preview render failed:', err);
      setLoading(false);
    }
  }, [markdown, page, font, extensions, cover, headerFooter, locale, ensureFrameReady, setLayoutDOM]);

  doFullRenderRef.current = doFullRender;

  // 初始化 PreviewOrchestrator
  useEffect(() => {
    const orchestrator = new PreviewOrchestrator(pagedJsAdapter);
    orchestratorRef.current = orchestrator;

    // 订阅事件
    const unsub = orchestrator.on((event) => {
      switch (event.type) {
        case 'render-start':
          // visual-only 不显示 Loading
          if (event.category !== 'visual-only') {
            setLoading(true);
          }
          setSettingChangeCategory(event.category);
          break;
        case 'render-complete':
          if (event.category !== 'visual-only') {
            setLoading(false);
          }
          // 更新 Layout DOM 到 Store
          const layoutDOM = layoutDOMManager.getCurrent();
          if (layoutDOM) {
            setLayoutDOM(layoutDOM);
            setPageCount(layoutDOM.metadata.totalPages);
            const renderedHtml = layoutDOM.document.documentElement.outerHTML;
            lastRenderResultRef.current = {
              html: renderedHtml,
              totalPages: layoutDOM.metadata.totalPages,
            };
          }
          break;
        case 'visual-only-update':
          if (event.result.success) {
            needsCorrectionRef.current = true;
            // 设置延迟修正定时器
            if (visualCorrectionTimerRef.current) {
              clearTimeout(visualCorrectionTimerRef.current);
            }
            visualCorrectionTimerRef.current = setTimeout(() => {
              needsCorrectionRef.current = false;
              doFullRenderRef.current();
            }, VISUAL_CORRECTION_DELAY);
          }
          break;
        case 'overflow-detected':
          console.warn('[PreviewPanel] Overflow detected after visual-only update:', event.result.overflowPages.length, 'pages');
          break;
        case 'error':
          console.error('[PreviewPanel] Render error:', event.error);
          setLoading(false);
          break;
      }
    });

    return () => {
      unsub();
      orchestrator.dispose();
      orchestratorRef.current = null;
    };
  }, [setLayoutDOM, setSettingChangeCategory]);

  // __aimtpGetLastRenderResult 全局钩子
  useEffect(() => {
    (window as any).__aimtpGetLastRenderResult = () => lastRenderResultRef.current;
    return () => {
      delete (window as any).__aimtpGetLastRenderResult;
    };
  }, []);

  /** 使用 PreviewOrchestrator 的 doRender */
  const doRender = useCallback(async () => {
    const currentRenderId = ++renderIdCounter;
    renderIdRef.current = currentRenderId;

    const prev = prevSettingsRef.current;
    const next = currentSnapshot();

    // 模板变更检测：模板切换时强制 content-change
    const templateChanged = prevTemplateRef.current !== currentTemplate;
    prevTemplateRef.current = currentTemplate;

    // 分类变更：模板变更覆盖分类结果
    const category: SettingChangeCategory = templateChanged
      ? 'content-change'
      : (prev ? classifySettingChange(prev, next) : 'content-change');
    prevSettingsRef.current = next;

    if (category === 'visual-only') {
      // visual-only: 使用 PreviewOrchestrator 快速路径
      const orchestrator = orchestratorRef.current;
      if (orchestrator) {
        const frame = frameRef.current;
        if (!frame) return;

        try {
          await ensureFrameReady(frame);
        } catch {
          return;
        }

        const sourceHash = layoutDOMManager['hashContent'](markdown);

        const context: RenderContext = {
          generateHtml: () => generateHtml({ markdown, locale, page, font, extensions, cover, headerFooter }),
          iframe: frame,
          sourceHash,
          stateSnapshot: { page, font, cover, headerFooter },
        };

        orchestrator.triggerRender(prev ?? next, next, context);
        setSettingChangeCategory('visual-only');
        return;
      }
      // 降级到完整渲染
    }

    // layout-change / content-change: 完整渲染
    setLoading(true);
    try {
      const html = await generateHtml({
        markdown, locale, page, font, extensions, cover, headerFooter,
      });

      if (renderIdRef.current !== currentRenderId) { setLoading(false); return; }

      const frame = frameRef.current;
      if (!frame) { setLoading(false); return; }

      try {
        await ensureFrameReady(frame);
      } catch {
        setLoading(false);
        return;
      }

      if (renderIdRef.current !== currentRenderId) { setLoading(false); return; }

      const sourceHash = layoutDOMManager['hashContent'](markdown);

      // F0: 在 layout 前设置页眉页脚配置
      pagedJsAdapter.setHeaderFooterConfig(
        buildHeaderFooterConfig(headerFooter),
        extractFrontMatter(markdown),
      );

      const layoutDOM = await pagedJsAdapter.layout(html, frame, sourceHash);

      if (renderIdRef.current !== currentRenderId) { setLoading(false); return; }

      layoutDOMManager.update(layoutDOM);
      setLayoutDOM(layoutDOM);

      const renderedHtml = layoutDOM.document.documentElement.outerHTML;
      lastRenderResultRef.current = { html: renderedHtml, totalPages: layoutDOM.metadata.totalPages };

      setPageCount(layoutDOM.metadata.totalPages);
      setSettingChangeCategory(category);
      setLoading(false);
    } catch (err) {
      console.error('[Aimtp] Preview render failed:', err);
      setLoading(false);
    }
  }, [markdown, page, font, extensions, cover, headerFooter, locale, currentTemplate, currentSnapshot, ensureFrameReady, setLayoutDOM, setSettingChangeCategory]);

  // 设置变更触发渲染（防抖）
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (isGenerating) return;

    // 分类变更，选择不同的防抖延迟
    const prev = prevSettingsRef.current;
    const next = currentSnapshot();
    const category = prev ? classifySettingChange(prev, next) : 'content-change';

    const delay = category === 'visual-only' ? 56 : 300;

    debounceTimerRef.current = setTimeout(() => {
      doRender();
    }, delay);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [doRender, isGenerating, currentSnapshot]);

  // 初始渲染
  useEffect(() => {
    // 初始化 prevSettingsRef
    prevSettingsRef.current = currentSnapshot();
    prevTemplateRef.current = currentTemplate;
    doFullRender();
  }, []);

  // 清理 visual 修正定时器
  useEffect(() => {
    return () => {
      if (visualCorrectionTimerRef.current) {
        clearTimeout(visualCorrectionTimerRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} style={containerStyle} className="aimtp-preview-container">
      <iframe
        ref={frameRef}
        style={frameWrapperStyle}
        title="preview-frame"
      />
      {loading && (
        <div style={loadingOverlayStyle}>
          <span>{progressText || '渲染中...'}</span>
          {pageCount > 0 && <span>已渲染 {pageCount} 页</span>}
        </div>
      )}
    </div>
  );
};

export default PreviewPanel;
export { PreviewPanel };

// ─── F0: HeaderFooter 配置构建辅助函数 ───

/** 从 HeaderFooterSettings 构建 HeaderFooterConfig */
function buildHeaderFooterConfig(
  hf: HeaderFooterSettings,
): HeaderFooterConfig {
  return {
    enabled: hf.enabled,
    header: {
      content: hf.header.content as 'title' | 'author' | 'date' | 'custom' | 'none',
      customText: hf.header.content === 'custom' ? hf.header.content : undefined,
      alignment: hf.header.alignment,
      font: hf.header.font,
    },
    footer: {
      content: hf.footer.content as 'pageNumber' | 'pageNumberTotal' | 'custom' | 'none',
      customText: hf.footer.content === 'custom' ? hf.footer.content : undefined,
      alignment: hf.footer.alignment,
      font: hf.footer.font,
    },
    coverPageExempt: true,
  };
}

/** 从 Markdown 提取 front matter 元数据 */
function extractFrontMatter(markdown: string): FrontMatter {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const yaml = match[1];
  const get = (key: string) => {
    const m = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return m?.[1]?.trim().replace(/^["']|["']$/g, '') ?? undefined;
  };
  return { title: get('title'), author: get('author'), date: get('date') };
}
