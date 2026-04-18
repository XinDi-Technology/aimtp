import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import { t } from '../shared/i18n';

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    // 注意：Windows 系统在没有显式设置 title 时，可能会在任务栏等位置将 productName 显示为大写 "AIMTP"
    // 添加 title 属性确保显示为 "Aimtp"
    title: 'Aimtp',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(join(app.getAppPath(), 'dist', 'renderer', 'index.html'));
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Window failed to load:', errorCode, errorDescription);
  });
}

ipcMain.handle('select-file', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    return { path: filePath, content };
  } catch (error) {
    console.error('Error selecting file:', error);
    throw new Error(t('file-read-error'));
  }
});

ipcMain.handle('select-save-path', async (_) => {
  try {
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      defaultPath: 'document.pdf',
    });
    if (result.canceled || !result.filePath) {
      return null;
    }
    return result.filePath;
  } catch (error) {
    console.error('Error selecting save path:', error);
    throw error;
  }
});

ipcMain.handle('save-pdf-to-path', async (_, data: Uint8Array, filePath: string) => {
  try {
    if (!data || !filePath) {
      throw new Error('Invalid data or file path');
    }
    fs.writeFileSync(filePath, Buffer.from(data));
    return filePath;
  } catch (error) {
    console.error('Error saving PDF:', error);
    throw new Error(t('file-write-error'));
  }
});

ipcMain.handle('generate-pdf', async (_event, options: { html: string; page: any; locale?: 'zh' | 'en' }) => {
  const locale: 'zh' | 'en' = options.locale || 'zh';

  if (!mainWindow) {
    throw new Error(t('no-main-window', locale));
  }

  let pdfWindow: BrowserWindow | null = null;
  let tempHtmlPath: string | null = null;

  try {
    const { page } = options;
    const margins = page.margins || { top: 20, bottom: 20, left: 20, right: 20 };
    
    const pageSize = page.size === 'A4' ? 'A4' : page.size === 'Letter' ? 'Letter' : page.size === 'A3' ? 'A3' : 'A4';
    
    const maxMargins: Record<string, number> = {
      A4: 15,
      Letter: 15,
      A3: 20,
    };
    const maxMargin = maxMargins[pageSize] || 15;
    const safeMargin = (value: number) => Math.min(Math.max(value || 10, 3), maxMargin);
    
    pdfWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    tempHtmlPath = path.join(app.getPath('temp'), 'aimtp-pdf-temp.html');
    fs.writeFileSync(tempHtmlPath, options.html);
    await pdfWindow.loadFile(tempHtmlPath);

    // 等待页面加载和脚本执行完成
    // Mermaid 和 MathJax 需要时间渲染图表
    await new Promise<void>((resolve) => {
      let resolved = false;
      const resolveOnce = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };
      // 等待页面完全加载
      pdfWindow!.webContents.once('did-finish-load', resolveOnce);
      pdfWindow!.webContents.once('did-fail-load', resolveOnce);
      // 额外等待时间确保 Mermaid/MathJax 渲染完成
      setTimeout(resolveOnce, 3000);
    });
    
    // 额外等待以确保动态内容渲染完成
    await new Promise(resolve => setTimeout(resolve, 1000));

    const pdfData = await pdfWindow.webContents.printToPDF({
      pageSize,
      margins: {
        top: safeMargin(margins.top) / 25.4, // mm to inches
        bottom: safeMargin(margins.bottom) / 25.4,
        left: safeMargin(margins.left) / 25.4,
        right: safeMargin(margins.right) / 25.4,
      },
      printBackground: true,
      preferCSSPageSize: false,
    });

    return pdfData;
  } catch (error) {
    logger.error('Error generating PDF:', error);
    throw new Error(t('pdf-generation-error'));
  } finally {
    if (pdfWindow && !pdfWindow.isDestroyed()) {
      pdfWindow.destroy();
    }
    if (tempHtmlPath && fs.existsSync(tempHtmlPath)) {
      try {
        fs.unlinkSync(tempHtmlPath);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup temp file:', cleanupError);
      }
    }
  }
});

app.on('before-quit', () => {
  logger.log('Application is about to quit');
});

app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'http://localhost:5173' && !navigationUrl.startsWith('file://')) {
      event.preventDefault();
    }
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in main process:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection in main process:', promise, reason);
});

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