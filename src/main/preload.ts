import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectSavePath: () => ipcRenderer.invoke('select-save-path'),
  savePdfToPath: (data: Uint8Array, filePath: string) => ipcRenderer.invoke('save-pdf-to-path', data, filePath),
  generatePdf: (options: { 
    markdown: string; 
    page: any; 
    font: any; 
    html: string;
    locale?: string;
  }) => ipcRenderer.invoke('generate-pdf', options),
});