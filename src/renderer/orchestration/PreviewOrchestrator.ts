/**
 * PreviewOrchestrator — 预览渲染流程编排器
 *
 * 编排变更分类 → visual-only 快速路径 / layout-change 重新分页 / content-change 完整渲染
 *
 * 三分支预览流程：
 * 1. visual-only: 调用 applyVisualOnlyUpdate()，不显示 Loading 遮罩 (~56ms)
 * 2. layout-change: 调用 PagedJsAdapter.layout() 重新分页，显示 Loading
 * 3. content-change: 调用 htmlGenerator + PagedJsAdapter.layout() 完整渲染，显示 Loading
 *
 * 防抖策略：按 SettingChangeCategory 选择不同延迟
 * - visual-only: 56ms（即时反馈）
 * - layout-change: 300ms（避免频繁重新分页）
 * - content-change: 300ms（Markdown 编辑防抖）
 */

import type { LayoutDOM } from '../domain/LayoutDOM';
import { layoutDOMManager } from '../domain/LayoutDOMManager';
import { PagedJsAdapter } from '../domain/PagedJsAdapter';
import { SettingChangeClassifier, createSettingsSnapshot, classifySettingChange } from './SettingChangeClassifier';
import type { AppSettingsSnapshot, SettingChangeCategory } from './SettingChangeClassifier';
import { applyVisualOnlyUpdate, detectOverflow } from './applyVisualOnlyUpdate';
import type { VisualOnlyUpdateResult, OverflowDetectionResult } from './applyVisualOnlyUpdate';
import { buildFinalCss } from '../utils/cssTemplate';
import previewCssTemplate from '../assets/preview.css?raw';

/** 设置变更去抖动配置 */
const SETTING_CHANGE_DEBOUNCE = {
  visualOnly: 56,       // ms，与 applyVisualOnlyUpdate 耗时匹配
  layoutChange: 300,    // ms，避免连续调整滑块时频繁重新分页
  contentChange: 300,   // ms，Markdown 编辑防抖
} as const;

/** 渲染路径统计 */
export interface RenderPathStats {
  visualOnlyCount: number;
  fullRenderCount: number;
  visualOnlyTotalMs: number;
  fullRenderTotalMs: number;
  savedMs: number;
}

/** 预览编排器事件 */
export type PreviewOrchestratorEvent =
  | { type: 'render-start'; category: SettingChangeCategory }
  | { type: 'render-complete'; category: SettingChangeCategory; durationMs: number }
  | { type: 'visual-only-update'; result: VisualOnlyUpdateResult }
  | { type: 'overflow-detected'; result: OverflowDetectionResult }
  | { type: 'error'; error: Error };

/** 事件监听器 */
export type PreviewOrchestratorListener = (event: PreviewOrchestratorEvent) => void;

/**
 * PreviewOrchestrator — 预览渲染流程编排器
 *
 * 用法：
 *   const orchestrator = new PreviewOrchestrator();
 *   orchestrator.triggerRender(prevSettings, nextSettings, renderContext);
 */
export class PreviewOrchestrator {
  private classifier = new SettingChangeClassifier();
  private pagedJsAdapter: PagedJsAdapter;
  private prevSettings: AppSettingsSnapshot | null = null;
  private listeners: PreviewOrchestratorListener[] = [];
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private stats: RenderPathStats = {
    visualOnlyCount: 0,
    fullRenderCount: 0,
    visualOnlyTotalMs: 0,
    fullRenderTotalMs: 0,
    savedMs: 0,
  };
  private disposed = false;

  constructor(pagedJsAdapter: PagedJsAdapter) {
    this.pagedJsAdapter = pagedJsAdapter;
  }

  /**
   * 触发渲染（防抖）
   *
   * 根据 SettingChangeClassifier 分类选择路径，按类别使用不同防抖延迟。
   * 连续变更时取消前一次待执行的更新。
   */
  triggerRender(
    prevSettings: AppSettingsSnapshot,
    nextSettings: AppSettingsSnapshot,
    context: RenderContext,
  ): void {
    if (this.disposed) return;

    const result = this.classifier.classify(prevSettings, nextSettings);
    const category = result.category;

    // 保存 prev settings
    this.prevSettings = createSettingsSnapshot(nextSettings);

    // 取消之前同类型的防抖
    const debounceKey = category;
    const existingTimer = this.debounceTimers.get(debounceKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 选择防抖延迟
    const delay = category === 'visual-only'
      ? SETTING_CHANGE_DEBOUNCE.visualOnly
      : category === 'layout-change'
        ? SETTING_CHANGE_DEBOUNCE.layoutChange
        : SETTING_CHANGE_DEBOUNCE.contentChange;

    // 设置新防抖
    const timer = setTimeout(() => {
      this.debounceTimers.delete(debounceKey);
      this.executeRender(category, context);
    }, delay);

    this.debounceTimers.set(debounceKey, timer);
  }

  /**
   * 立即完整渲染（导出前使用）
   *
   * 取消所有待执行的防抖，立即执行 content-change 路径。
   */
  async forceRender(context: RenderContext): Promise<LayoutDOM | null> {
    this.cancelPending();

    try {
      return await this.executeFullRender(context);
    } catch (err) {
      this.emit({ type: 'error', error: err as Error });
      return null;
    }
  }

  /** 获取当前 Layout DOM */
  getCurrentLayoutDOM(): LayoutDOM | null {
    return layoutDOMManager.getCurrent();
  }

  /** 获取渲染路径统计 */
  getStats(): RenderPathStats {
    return { ...this.stats };
  }

  /** 取消所有待执行的防抖 */
  cancelPending(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  /** 订阅事件 */
  on(listener: PreviewOrchestratorListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  /** 释放资源 */
  dispose(): void {
    this.disposed = true;
    this.cancelPending();
    this.listeners = [];
  }

  // ─── Private Methods ───

  private emit(event: PreviewOrchestratorEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.warn('[PreviewOrchestrator] Listener error:', err);
      }
    }
  }

  private async executeRender(category: SettingChangeCategory, context: RenderContext): Promise<void> {
    if (this.disposed) return;

    const startTime = performance.now();
    this.emit({ type: 'render-start', category });

    try {
      if (category === 'visual-only') {
        await this.executeVisualOnlyUpdate(context);
      } else if (category === 'layout-change') {
        await this.executeLayoutChange(context);
      } else {
        await this.executeContentChange(context);
      }

      const durationMs = performance.now() - startTime;
      this.emit({ type: 'render-complete', category, durationMs });

      // 更新统计
      if (category === 'visual-only') {
        this.stats.visualOnlyCount++;
        this.stats.visualOnlyTotalMs += durationMs;
        this.stats.savedMs += (990 - durationMs); // 预估节省时间
      } else {
        this.stats.fullRenderCount++;
        this.stats.fullRenderTotalMs += durationMs;
      }
    } catch (err) {
      this.emit({ type: 'error', error: err as Error });
    }
  }

  /** visual-only 路径：只替换 CSS，不重新分页 */
  private async executeVisualOnlyUpdate(context: RenderContext): Promise<void> {
    const layoutDOM = layoutDOMManager.getCurrent();
    if (!layoutDOM) {
      // 无现有 Layout DOM，降级为完整渲染
      await this.executeFullRender(context);
      return;
    }

    // 生成新 CSS
    const newCss = buildFinalCss(previewCssTemplate, context.stateSnapshot);

    // 应用 CSS 更新
    const result = await applyVisualOnlyUpdate(layoutDOM, newCss);
    this.emit({ type: 'visual-only-update', result });

    if (!result.success) {
      // CSS 更新失败，降级为完整渲染
      await this.executeFullRender(context);
      return;
    }

    // 异步溢出检测
    const overflow = detectOverflow(layoutDOM);
    if (overflow.hasOverflow) {
      this.emit({ type: 'overflow-detected', result: overflow });
      // 标记需要修正，但不立即触发完整渲染（释放滑块后由调用方触发）
    }
  }

  /** layout-change 路径：重新分页 */
  private async executeLayoutChange(context: RenderContext): Promise<void> {
    // 需要重新生成 HTML（但 markdown 内容未变，可复用）
    await this.executeFullRender(context);
  }

  /** content-change 路径：完整重新渲染 */
  private async executeContentChange(context: RenderContext): Promise<void> {
    await this.executeFullRender(context);
  }

  /** 执行完整渲染（htmlGenerator + PagedJsAdapter.layout） */
  private async executeFullRender(context: RenderContext): Promise<LayoutDOM | null> {
    const { generateHtml, iframe, sourceHash } = context;

    const html = await generateHtml();
    const layoutDOM = await this.pagedJsAdapter.layout(html, iframe, sourceHash);

    // 更新 LayoutDOMManager
    layoutDOMManager.update(layoutDOM);

    return layoutDOM;
  }
}

/** 渲染上下文 */
export interface RenderContext {
  /** 生成 HTML 的函数 */
  generateHtml: () => Promise<string>;
  /** 预览 iframe */
  iframe: HTMLIFrameElement;
  /** 源内容 hash */
  sourceHash: string;
  /** 当前设置快照 */
  stateSnapshot: {
    page: AppSettingsSnapshot['page'];
    font: AppSettingsSnapshot['font'];
    cover: AppSettingsSnapshot['cover'];
    headerFooter: AppSettingsSnapshot['headerFooter'];
    preview: AppSettingsSnapshot['preview'];
  };
}
