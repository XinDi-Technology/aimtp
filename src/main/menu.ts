import { app, Menu, MenuItemConstructorOptions, dialog } from 'electron';
import { t, type Locale } from '../shared/i18n';

/**
 * 构建应用原生菜单。
 *
 * 重构后只保留三个顶层菜单：文件（仅退出）、视图（仅开发者工具）、帮助（关于）。
 * 删除默认菜单里的 Edit / Window 以及 Reload / Zoom 等与本工具无关的项；
 * 菜单文案随界面语言（locale）切换而重建，文案真源在 src/shared/i18n.ts。
 */
export function buildMenu(locale: Locale): Menu {
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
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
