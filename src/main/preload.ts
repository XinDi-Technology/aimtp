import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectSavePath: () => ipcRenderer.invoke('select-save-path'),
  savePdfToPath: (data: Uint8Array, filePath: string) =>
    ipcRenderer.invoke('save-pdf-to-path', data, filePath),
  exportPdf: (html: string, page: any, locale: string) =>
    ipcRenderer.invoke('generate-pdf', { html, page, locale }),
  printFromLayoutHtml: (layoutHtml: string, pageConfig: { size: string; orientation: string }) =>
    ipcRenderer.invoke('pdf:print-from-layout-html', { layoutHtml, pageConfig }),
  onWindowStateChanged: (callback: (data: { isMaximized: boolean }) => void) => {
    ipcRenderer.on('window-state-changed', (_event, data) => callback(data));
  },
});
