export type ExportStage =
  | 'validate'
  | 'prepare'
  | 'pdfGenerate'
  | 'postProcess'
  | 'save';

export interface ExportProgress {
  stage: ExportStage;
  percentage: number;
  message: string;
}

export interface ExportOptions {
  pageSize: string;
  orientation: string;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  /** 原始错误详情：用于日志排查，不应直接展示给用户 */
  error?: string;
  /** 错误码（形如 'errors.pdfGenerationError'）：由渲染层按界面语言翻译后再展示 */
  errorCode?: string;
}
