import type {
  LayoutDOM,
  LayoutDOMMetadata,
  LayoutDOMProvenance,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './LayoutDOM';

export class LayoutDOMManager {
  private current: LayoutDOM | null = null;
  private sourceHash: string = '';

  getCurrent(): LayoutDOM | null {
    return this.current;
  }

  update(layoutDOM: LayoutDOM): void {
    this.current = layoutDOM;
  }

  invalidate(): void {
    this.current = null;
  }

  validate(currentMarkdown: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!this.current) {
      errors.push({
        code: 'EMPTY_LAYOUT',
        message: 'Layout DOM is empty',
        recoverable: true,
      });
      return { isValid: false, errors, warnings };
    }

    const layout = this.current;

    if (this.isStale(layout, currentMarkdown)) {
      errors.push({
        code: 'STALE_LAYOUT',
        message: 'Layout DOM is stale (source has changed)',
        recoverable: true,
      });
    }

    if (layout.metadata.totalPages <= 0) {
      errors.push({
        code: 'NO_PAGES',
        message: 'Layout DOM has no pages',
        recoverable: false,
      });
    }

    if (!layout.iframe || !layout.iframe.contentDocument) {
      errors.push({
        code: 'IFRAME_DESTROYED',
        message: 'iframe has been destroyed',
        recoverable: true,
      });
    }

    if (Date.now() - layout.provenance.renderedAt > 30000) {
      warnings.push({
        code: 'OLD_RENDER',
        message: 'Layout DOM is older than 30 seconds',
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  extractMetadata(iframe: HTMLIFrameElement): LayoutDOMMetadata {
    const doc = iframe.contentDocument;
    if (!doc) {
      return {
        totalPages: 0,
        pageSize: { width: 210, height: 297 },
        hasCoverPage: false,
        headerFooterMaterialized: false,
        cssArchitectureValid: false,
      };
    }

    const pages = doc.querySelectorAll('.pagedjs_page');
    const coverPage = doc.querySelector('.cover-page');

    return {
      totalPages: pages.length,
      pageSize: { width: 210, height: 297 },
      hasCoverPage: !!coverPage,
      headerFooterMaterialized: !!doc.querySelector('.aimtp-page-header') || !!doc.querySelector('.aimtp-page-footer'),
      cssArchitectureValid: !!doc.querySelector('style[data-aimtp-css]'),
    };
  }

  buildProvenance(sourceMarkdown: string, webContentsId: number): LayoutDOMProvenance {
    return {
      sourceHash: this.hashContent(sourceMarkdown),
      renderedAt: Date.now(),
      webContentsId,
    };
  }

  private isStale(layout: LayoutDOM, currentMarkdown: string): boolean {
    return layout.provenance.sourceHash !== this.hashContent(currentMarkdown);
  }

  hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
    }
    return String(hash);
  }
}

export const layoutDOMManager = new LayoutDOMManager();
