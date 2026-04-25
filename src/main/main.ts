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
    title: 'Aimtp',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize();
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
    // [TODO] 问题5：应统一使用 logger.error
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
    // [TODO] 问题5：应统一使用 logger.error
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
    // [TODO] 问题5：应统一使用 logger.error
    console.error('Error saving PDF:', error);
    throw new Error(t('file-write-error'));
  }
});

// TODO: [P0-问题1] PDF 生成逻辑已过时
// 当前实现：创建隐藏的 pdfWindow，等待 Mermaid/MathJax 渲染（3-4秒）
// 问题：htmlGenerator 已经预渲染为 SVG，HTML 是静态的，不需要再等待
// 影响：性能浪费、资源浪费、临时文件管理
// 修复方案：简化此 handler，直接使用 mainWindow 或更简单的方式打印 PDF
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
    
    const isPortrait = page.orientation === 'portrait';
    const pageSizeMap: Record<string, { width: number; height: number }> = {
      A4: { width: 210000, height: 297000 },
      A3: { width: 297000, height: 420000 },
      Letter: { width: 215900, height: 279400 },
    };
    const basePageSize = pageSizeMap[page.size] || pageSizeMap.A4;
    const pageSize = isPortrait
      ? basePageSize
      : { width: basePageSize.height, height: basePageSize.width };
    
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
    const appPath = app.getAppPath();
    const fontsPath = isDev 
      ? path.join(appPath, 'src', 'fonts') 
      : path.join(appPath, 'dist', 'renderer', 'fonts');
    const fontsPathUrl = `file://${fontsPath.replace(/\\/g, '/')}`;
    
    let htmlContent = options.html;
    // 替换字体 URL 为绝对路径 (同时处理单引号和双引号)
    htmlContent = htmlContent.replace(/url\(['"]fonts\//g, `url('${fontsPathUrl}/`);
    // 处理 FONTS_PATH 占位符
    htmlContent = htmlContent.replace(/file:\/\/FONTS_PATH\//g, fontsPathUrl);
    fs.writeFileSync(tempHtmlPath, htmlContent);
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
      // [TODO] 问题3：PDF生成性能
    // htmlGenerator.ts 已预渲染 Mermaid/MathJax 为 SVG，此处等待3秒不必要
      setTimeout(resolveOnce, 3000);
    });

    // 等待字体加载完成
    await pdfWindow.webContents.executeJavaScript(`
      new Promise((resolve) => {
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(resolve).catch(resolve);
        } else {
          resolve();
        }
      })
    `);

    // [TODO] 问题3：预渲染已完成，此处1秒延迟可移除或大幅缩短
    await new Promise(resolve => setTimeout(resolve, 500));

    const pdfData = await pdfWindow.webContents.printToPDF({
      pageSize,
      margins: {
        top: margins.top / 25.4, // mm to inches
        bottom: margins.bottom / 25.4,
        left: margins.left / 25.4,
        right: margins.right / 25.4,
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