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
  // 自定义模板：以 JSON 文件形式存放在 userData/templates，卸载时不会被删除
  templates: {
    list: () => ipcRenderer.invoke('templates:list'),
    save: (record: { id: string; name: string; settings: unknown; createdAt: number }) =>
      ipcRenderer.invoke('templates:save', record),
    remove: (id: string) => ipcRenderer.invoke('templates:remove', id),
    clear: () => ipcRenderer.invoke('templates:clear'),
    dir: () => ipcRenderer.invoke('templates:dir'),
    openDir: () => ipcRenderer.invoke('templates:openDir'),
  },
});
