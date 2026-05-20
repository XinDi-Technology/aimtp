export interface LayoutDOMMetadata {
  totalPages: number;
  pageSize: { width: number; height: number };
  hasCoverPage: boolean;
  headerFooterMaterialized: boolean;
  cssArchitectureValid: boolean;
}

export interface LayoutDOMProvenance {
  sourceHash: string;
  renderedAt: number;
  webContentsId: number;
}

export interface LayoutDOM {
  document: Document;
  iframe: HTMLIFrameElement;
  metadata: LayoutDOMMetadata;
  provenance: LayoutDOMProvenance;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: 'EMPTY_LAYOUT' | 'STALE_LAYOUT' | 'NO_PAGES' | 'IFRAME_DESTROYED';
  message: string;
  recoverable: boolean;
}

export interface ValidationWarning {
  code: string;
  message: string;
}
