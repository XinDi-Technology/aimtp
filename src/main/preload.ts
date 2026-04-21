import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectSavePath: () => ipcRenderer.invoke('select-save-path'),
  savePdfToPath: (data: Uint8Array, filePath: string) => ipcRenderer.invoke('save-pdf-to-path', data, filePath),
  // [TODO] 问题6：page/font 使用 any，应定义具体类型
  generatePdf: (options: {
    markdown: string;
    page: any;
    font: any;
    html: string;
    locale?: string;
  }) => ipcRenderer.invoke('generate-pdf', options),
});