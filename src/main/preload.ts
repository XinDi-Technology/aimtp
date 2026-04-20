import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectSavePath: () => ipcRenderer.invoke('select-save-path'),
  savePdfToPath: (data: Uint8Array, filePath: string) => ipcRenderer.invoke('save-pdf-to-path', data, filePath),
  // TODO: [潜在问题6] 参数类型定义为 any，缺少严格类型检查
  // 建议：定义明确的 GeneratePdfOptions 接口
  generatePdf: (options: { 
    markdown: string; 
    page: any; 
    font: any; 
    html: string;
    locale?: string;
  }) => ipcRenderer.invoke('generate-pdf', options),
});