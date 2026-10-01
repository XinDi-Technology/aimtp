import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectSavePath: () => ipcRenderer.invoke('select-save-path'),
  savePdfToPath: (data: Uint8Array, filePath: string) =>
    ipcRenderer.invoke('save-pdf-to-path', data, filePath),
  exportPdf: (html: string, page: { size?: string; orientation?: string }, locale: string) =>
    ipcRenderer.invoke('generate-pdf', { html, page, locale }),
  printFromLayoutHtml: (
    layoutHtml: string,
    pageConfig: { size: string; orientation: string },
    metadata?: { title?: string; author?: string; subject?: string; keywords?: string[] },
  ) => ipcRenderer.invoke('pdf:print-from-layout-html', { layoutHtml, pageConfig, metadata }),
  onWindowStateChanged: (callback: (data: { isMaximized: boolean }) => void) => {
    ipcRenderer.on('window-state-changed', (_event, data) => callback(data));
  },
});
