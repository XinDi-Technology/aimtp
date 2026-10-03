import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectSavePath: () => ipcRenderer.invoke('select-save-path'),
  savePdfToPath: (data: Uint8Array, filePath: string) =>
    ipcRenderer.invoke('save-pdf-to-path', data, filePath),
  printFromLayoutHtml: (
    layoutHtml: string,
    pageConfig: { size: string; orientation: string },
    metadata?: { title?: string; author?: string; subject?: string; keywords?: string[] },
  ) => ipcRenderer.invoke('pdf:print-from-layout-html', { layoutHtml, pageConfig, metadata }),
});
