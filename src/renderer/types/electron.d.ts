export {};

declare global {
  interface Window {
    electronAPI?: {
      selectFile: () => Promise<{ path: string; content: string } | null>;
      selectSavePath: () => Promise<string | null>;
      savePdfToPath: (data: Uint8Array, filePath: string) => Promise<string>;
      generatePdf: (options: {
        markdown: string;
        page: {
          size: string;
          orientation: string;
          margins: { top: number; bottom: number; left: number; right: number };
        };
        font: any;
        html: string;
        locale?: string;
      }) => Promise<Uint8Array>;
    };
  }
}