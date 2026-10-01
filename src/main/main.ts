import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { join } from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { logger } from './logger';
import { t } from '../shared/i18n';

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Aimtp',
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-state-changed', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-state-changed', { isMaximized: false });
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(join(app.getAppPath(), 'dist', 'renderer', 'index.html'));
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logger.error('Window failed to load:', errorCode, errorDescription);
  });
}

ipcMain.handle('select-file', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    return { path: filePath, content };
  } catch (error) {
    logger.error('Error selecting file:', error);
    throw new Error(t('file-read-error'), { cause: error });
  }
});

ipcMain.handle('select-save-path', async () => {
  try {
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      defaultPath: 'document.pdf',
    });
    if (result.canceled || !result.filePath) return null;
    return result.filePath;
  } catch (error) {
    logger.error('Error selecting save path:', error);
    throw error;
  }
});

ipcMain.handle('save-pdf-to-path', async (_, data: Uint8Array, filePath: string) => {
  try {
    if (!data || !filePath) throw new Error('Invalid data or file path');
    fs.writeFileSync(filePath, Buffer.from(data));
    return filePath;
  } catch (error) {
    logger.error('Error saving PDF:', error);
    throw new Error(t('file-write-error'), { cause: error });
  }
});

function getPageDimensionsMm(size: string, landscape: boolean): { width: number; height: number } {
  let w: number, h: number;
  if (size === 'A3') {
    w = 297; h = 420;
  } else {
    w = 210; h = 297;
  }
  return landscape ? { width: h, height: w } : { width: w, height: h };
}

ipcMain.handle('generate-pdf', async (_event, options: { html: string; page: { size?: string; orientation?: string }; locale?: 'zh' | 'en' }) => {
  let pdfWindow: BrowserWindow | null = null;

  try {
    const pageSize = (options.page.size || 'A4') as 'A3' | 'A4';
    const isLandscape = options.page.orientation === 'landscape';
    const pageDims = getPageDimensionsMm(pageSize, isLandscape);
    const width = Math.round(pageDims.width * 96 / 25.4);
    const height = Math.round(pageDims.height * 96 / 25.4);

    pdfWindow = new BrowserWindow({
      width,
      height,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    await pdfWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(options.html)}`
    );

    await new Promise<void>((resolve) => {
      pdfWindow!.webContents.once('did-finish-load', () => resolve());
      setTimeout(resolve, 5000);
    });

    await pdfWindow.webContents.insertCSS(`
      .pagedjs_sheet, .pagedjs_pages, .pagedjs_page {
        position: static !important;
      }
      .pagedjs_page {
        display: block !important;
        break-after: page !important;
        page-break-after: always !important;
        margin: 0 auto !important;
      }
      .pagedjs_page:last-child {
        break-after: auto !important;
        page-break-after: auto !important;
      }
    `);

    await pdfWindow.webContents.executeJavaScript('document.fonts.ready');

    const pdfData = await pdfWindow.webContents.printToPDF({
      pageSize,
      landscape: isLandscape,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      printBackground: true,
      preferCSSPageSize: false,
    });

    return pdfData;
  } catch (error) {
    logger.error('Error generating PDF:', error);
    throw new Error(t('pdf-generation-error'), { cause: error });
  } finally {
    if (pdfWindow && !pdfWindow.isDestroyed()) {
      pdfWindow.destroy();
    }
  }
});

ipcMain.handle('pdf:print-from-layout-html', async (
  _event,
  options: {
    layoutHtml: string;
    pageConfig: { size: string; orientation: string };
    metadata?: { title?: string; author?: string; subject?: string; keywords?: string[] };
  },
) => {
  let pdfWindow: BrowserWindow | null = null;
  let tmpFile = '';

  try {
    const pageSize = (options.pageConfig.size || 'A4') as 'A3' | 'A4';
    const isLandscape = options.pageConfig.orientation === 'landscape';
    const pageDims = getPageDimensionsMm(pageSize, isLandscape);
    const width = Math.round(pageDims.width * 96 / 25.4);
    const height = Math.round(pageDims.height * 96 / 25.4);

    pdfWindow = new BrowserWindow({
      width,
      height,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
      },
    });

    // Use file:// URL instead of data:text/html so @font-face with file:///
    // paths can resolve correctly (data:text/html blocks cross-origin font loading)
    // webSecurity: false 允许临时 HTML 跨目录加载 woff2 字体文件
    tmpFile = join(os.tmpdir(), `aimtp-export-${Date.now()}.html`);
    fs.writeFileSync(tmpFile, options.layoutHtml, 'utf8');
    const tmpUrl = 'file:///' + tmpFile.replace(/\\/g, '/');

    await pdfWindow.loadURL(tmpUrl);

    await new Promise<void>((resolve) => {
      pdfWindow!.webContents.once('did-finish-load', () => resolve());
      setTimeout(resolve, 5000);
    });

    // 补充 margin box 可见性保障，确保页眉页脚在 print 上下文中正常显示
    await pdfWindow.webContents.insertCSS(`
      .pagedjs_margin,
      .pagedjs_margin-content {
        visibility: visible !important;
      }
      .aimtp-page-header,
      .aimtp-page-footer {
        position: static !important;
        visibility: visible !important;
        overflow: visible !important;
      }
      .pagedjs_margin-top-center,
      .pagedjs_margin-bottom-center,
      .pagedjs_margin-top-left,
      .pagedjs_margin-bottom-left,
      .pagedjs_margin-top-right,
      .pagedjs_margin-bottom-right {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
    `);

    await pdfWindow.webContents.executeJavaScript('document.fonts.ready');

    const pdfData = await pdfWindow.webContents.printToPDF({
      pageSize,
      landscape: isLandscape,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      printBackground: true,
      preferCSSPageSize: false,
    });

    // [PDF-METADATA] Chromium printToPDF only writes Title (taken from
    // document.title, which stays the app name) and does not support
    // Author/Subject/Keywords at all. Write the YAML Front Matter derived
    // document properties into the PDF Info dictionary via pdf-lib.
    let output: Uint8Array = pdfData;
    if (options.metadata) {
      try {
        const { PDFDocument } = await import('@cantoo/pdf-lib');
        const pdfDoc = await PDFDocument.load(pdfData);
        // Keep PDF 1.4: this fork preserves the original document header on save
        // (upstream pdf-lib forces %PDF-1.7), and Chromium printToPDF emits 1.4.
        // useObjectStreams must stay disabled: the default true would emit 1.5+
        // xref-stream structure that 1.4 readers cannot parse.
        const { title, author, subject, keywords } = options.metadata;
        if (title) pdfDoc.setTitle(title);
        if (author) pdfDoc.setAuthor(author);
        if (subject) pdfDoc.setSubject(subject);
        if (keywords?.length) pdfDoc.setKeywords(keywords);
        output = await pdfDoc.save({ useObjectStreams: false });
      } catch (metadataError) {
        logger.error('Failed to write PDF metadata:', metadataError);
      }
    }

    return output;
  } catch (error) {
    logger.error('Error in pdf:print-from-layout-html:', error);
    throw new Error(t('pdf-generation-error'), { cause: error });
  } finally {
    if (pdfWindow && !pdfWindow.isDestroyed()) {
      pdfWindow.destroy();
    }
    try { fs.unlinkSync(tmpFile); } catch { /* 临时文件清理失败可忽略 */ }
  }
});

app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'http://localhost:5173' && !navigationUrl.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  // will-frame-navigate 捕获 iframe 等子框架内的导航（will-navigate 仅对主框架生效）
  // 注意：Electron 回调签名为 (event, details)，preventDefault 在 event 上
  // Electron 44.5.1 的 d.ts 缺少该事件的重载（运行时 API 存在，见官方文档），故临时使用 @ts-expect-error
  // @ts-expect-error 待 Electron 上游补齐类型后移除此指令
  contents.on('will-frame-navigate', (event: { preventDefault(): void }, details: { url: string }) => {
    const { url } = details;
    if (url.startsWith('http://localhost:5173') || url.startsWith('file://')) {
      return;
    }
    event.preventDefault();
    shell.openExternal(url);
  });

  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost:5173') || url.startsWith('file://')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in main process:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection in main process:', promise, reason);
});

app.commandLine.appendSwitch('disable-font-subsetting');

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
