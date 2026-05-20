import { layoutDOMManager } from '../domain/LayoutDOMManager';
import type { LayoutDOM } from '../domain/LayoutDOM';
import type { ExportOptions, ExportProgress, ExportResult, ExportStage } from './ExportTypes';

const STAGE_PROGRESS: Record<ExportStage, [number, number]> = {
  validate: [0, 10],
  prepare: [10, 20],
  pdfGenerate: [20, 60],
  postProcess: [60, 90],
  save: [90, 100],
};

export class ExportOrchestrator {
  private abortController: AbortController | null = null;
  private progressCallback: ((p: ExportProgress) => void) | null = null;

  async start(options: ExportOptions, currentMarkdown: string): Promise<ExportResult> {
    this.abortController = new AbortController();

    try {
      this.emitProgress('validate', 0, 'Validating layout...');
      const layoutDOM = layoutDOMManager.getCurrent();
      const validation = layoutDOMManager.validate(currentMarkdown);

      if (!layoutDOM) {
        return { success: false, error: '预览尚未渲染完成，请稍候再试' };
      }

      if (!validation.isValid) {
        const errorMsg = validation.errors.map((e) => e.message).join('; ');
        return { success: false, error: `Validation failed: ${errorMsg}` };
      }

      this.checkAborted();

      this.emitProgress('prepare', 0, 'Preparing layout for export...');
      const layoutHtml = this.serializeLayoutDOM(layoutDOM);
      this.emitProgress('prepare', 100, 'Layout prepared');

      this.checkAborted();

      this.emitProgress('pdfGenerate', 0, 'Generating PDF...');
      const pdfData = await this.invokePdfGeneration(layoutHtml, options);
      this.emitProgress('pdfGenerate', 100, 'PDF generated');

      this.checkAborted();

      this.emitProgress('postProcess', 0, 'Post-processing...');
      this.emitProgress('postProcess', 100, 'Post-processing complete (no-op in iteration 1)');

      this.checkAborted();

      this.emitProgress('save', 0, 'Selecting save location...');
      const filePath = await this.selectSavePath();
      if (!filePath) {
        return { success: false, error: 'Save cancelled by user' };
      }

      this.emitProgress('save', 50, 'Saving PDF...');
      await this.savePdf(pdfData, filePath);
      this.emitProgress('save', 100, 'PDF saved');

      return { success: true, filePath };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Export cancelled' };
      }
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  cancel(): void {
    this.abortController?.abort();
  }

  onProgress(callback: (p: ExportProgress) => void): void {
    this.progressCallback = callback;
  }

  private async invokePdfGeneration(
    layoutHtml: string,
    options: ExportOptions,
  ): Promise<Uint8Array> {
    if (!window.electronAPI?.printFromLayoutHtml) {
      throw new Error('printFromLayoutHtml API not available');
    }
    return window.electronAPI.printFromLayoutHtml(layoutHtml, {
      size: options.pageSize,
      orientation: options.orientation,
    });
  }

  private async selectSavePath(): Promise<string | null> {
    if (!window.electronAPI?.selectSavePath) {
      throw new Error('selectSavePath API not available');
    }
    return window.electronAPI.selectSavePath();
  }

  private async savePdf(pdfData: Uint8Array, filePath: string): Promise<void> {
    if (!window.electronAPI?.savePdfToPath) {
      throw new Error('savePdfToPath API not available');
    }
    await window.electronAPI.savePdfToPath(pdfData, filePath);
  }

  private emitProgress(stage: ExportStage, stepProgress: number, message: string): void {
    if (!this.progressCallback) return;
    const [stageStart, stageEnd] = STAGE_PROGRESS[stage];
    const percentage = stageStart + (stageEnd - stageStart) * (stepProgress / 100);
    this.progressCallback({ stage, percentage, message });
  }

  private checkAborted(): void {
    if (this.abortController?.signal.aborted) {
      throw new DOMException('Export cancelled', 'AbortError');
    }
  }

  /**
   * 序列化 LayoutDOM，确保 outerHTML 反映 CSSOM 操作后的最终状态
   */
  private serializeLayoutDOM(layoutDOM: LayoutDOM): string {
    const doc = layoutDOM.document;

    // 1. 同步 CSSOM 到 DOM：将动态 CSSOM 操作（如 deleteRule）反映在 outerHTML 中
    this.syncCssomToDom(doc);

    // 2. 序列化
    let layoutHtml = doc.documentElement.outerHTML;

    // 3. 移除 fonts.css 的相对路径 @font-face 声明
    // 导出 HTML 位于 os.tmpdir()，相对路径 ./xxx.woff2 会指向临时目录而非字体目录，
    // 导致字体加载失败。htmlGenerator.ts 已生成使用绝对路径的 @font-face，仅需保留那些。
    layoutHtml = this.removeRelativeFontFaceDeclarations(layoutHtml);

    // 4. 日志：验证页眉页脚 DOM 元素是否包含在序列化结果中
    const hasHeader = layoutHtml.includes('aimtp-page-header');
    const hasFooter = layoutHtml.includes('aimtp-page-footer');
    console.debug('[ExportOrchestrator] serializeLayoutDOM:', {
      hasHeader,
      hasFooter,
      htmlLength: layoutHtml.length,
    });

    return layoutHtml;
  }

  /**
   * 移除使用相对路径的 @font-face 声明（来自 fonts.css 的 @import）
   *
   * 特征：fonts.css 生成的 @font-face 使用相对 URL（如 ./GWMSansUI-Regular.woff2），
   * 而 htmlGenerator.ts 生成的使用绝对 file:// URL。
   * 在导出 HTML 中，相对路径无法解析到字体文件，仅保留绝对路径声明。
   */
  private removeRelativeFontFaceDeclarations(html: string): string {
    return html.replace(
      /@font-face\s*\{[^}]*src:\s*url\(['"]?\.\/[^}]*\}/g,
      '',
    );
  }

  /**
   * 将 CSSOM 动态变更同步到 DOM <style> 元素
   *
   * 背景：stylesheet.deleteRule() 等 CSSOM 操作修改的是运行时 CSSOM，
   * 但 element.outerHTML 序列化可能不反映这些变更。
   * 此方法将每个 stylesheet 的 cssText 写回对应的 <style> 元素的 textContent，
   * 确保 outerHTML 包含最终的 CSS 状态。
   */
  private syncCssomToDom(doc: Document): void {
    try {
      const styleElements = doc.querySelectorAll('style');
      const styleSheets = doc.styleSheets;

      // 建立 stylesheet → style element 映射
      for (let i = 0; i < styleSheets.length && i < styleElements.length; i++) {
        try {
          const sheet = styleSheets[i];
          const styleEl = styleElements[i];

          // 检查 owningNode 是否匹配
          if ((sheet as any).owningNode === styleEl) {
            const cssText = Array.from(sheet.cssRules)
              .map(rule => rule.cssText)
              .join('\n');
            styleEl.textContent = cssText;
          }
        } catch (e) {
          // 跨域样式表会抛出 SecurityError，跳过
          if ((e as Error).name !== 'SecurityError') {
            console.warn('[ExportOrchestrator] syncCssomToDom error:', e);
          }
        }
      }
    } catch (e) {
      console.warn('[ExportOrchestrator] syncCssomToDom overall error:', e);
    }
  }
}

export const exportOrchestrator = new ExportOrchestrator();
