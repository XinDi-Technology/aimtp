export {};

declare global {
  interface Window {
    electronAPI?: {
      selectFile: () => Promise<{ path: string; content: string } | null>;
      selectSavePath: () => Promise<string | null>;
      savePdfToPath: (data: Uint8Array, filePath: string) => Promise<string>;
      exportPdf: (html: string) => Promise<Uint8Array>;
      printFromLayoutHtml: (
        layoutHtml: string,
        pageConfig: { size: string; orientation: string },
      ) => Promise<Uint8Array>;
      onWindowStateChanged: (callback: (data: { isMaximized: boolean }) => void) => void;
    };
    __aimtpGetLastRenderResult?: () => {
      html: string;
      totalPages: number;
    } | null;
  }
}
