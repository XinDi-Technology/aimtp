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
  locale: 'zh' | 'en';
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
}
