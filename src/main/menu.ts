import { app, Menu, MenuItemConstructorOptions, dialog, type BrowserWindow } from 'electron';
import * as fs from 'fs';
import { join } from 'path';
import { t, type Locale } from '../shared/i18n';

/**
 * 构建应用原生菜单。
 *
 * 重构后只保留三个顶层菜单：文件（仅退出）、视图（仅开发者工具）、帮助（关于 / 字体授权协议）。
 * 删除默认菜单里的 Edit / Window 以及 Reload / Zoom 等与本工具无关的项；
 * 菜单文案随界面语言（locale）切换而重建，文案真源在 src/shared/i18n.ts。
 */
export function buildMenu(locale: Locale, mainWindow: BrowserWindow | null): Menu {
  const m = (key: string) => t(`menu.${key}`, locale);

  const template: MenuItemConstructorOptions[] = [
    {
      label: m('file'),
      submenu: [{ label: m('quit'), role: 'quit' }],
    },
    {
      label: m('view'),
      submenu: [{ label: m('toggleDevTools'), role: 'toggleDevTools' }],
    },
    {
      label: m('help'),
      submenu: [
        {
          label: m('about'),
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: m('about'),
              message: `${app.getName()} v${app.getVersion()}`,
              detail: m('aboutDetail'),
            });
          },
        },
        {
          label: m('fontsLicense'),
          click: () => {
            const mdPath = app.isPackaged
              ? join(process.resourcesPath, 'fonts/GWM Sans license.md')
              : join(app.getAppPath(), 'src/fonts/GWM Sans license.md');
            try {
              const content = fs.readFileSync(mdPath, 'utf-8');
              mainWindow?.webContents.send('app:open-document', { content });
            } catch (err) {
              dialog.showErrorBox(m('fontsLicense'), String(err));
            }
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
