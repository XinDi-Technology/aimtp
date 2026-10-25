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
  // 通知主进程界面语言已变更，用于重建原生菜单文案（文件/视图/帮助等）
  setLocale: (locale: 'zh' | 'en') => ipcRenderer.send('app:locale-changed', locale),
  // 主进程以"类导入"方式请求渲染层打开一段文档内容（如字体授权协议），返回移除监听的清理函数
  onOpenDocument: (cb: (payload: { content: string }) => void) => {
    const listener = (_e: unknown, payload: unknown) => cb(payload as { content: string });
    ipcRenderer.on('app:open-document', listener);
    return () => ipcRenderer.removeListener('app:open-document', listener);
  },
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
