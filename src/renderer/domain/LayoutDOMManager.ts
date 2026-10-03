import type {
  LayoutDOM,
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
