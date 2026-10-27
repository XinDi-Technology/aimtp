declare const __FONTS_DIR__: string;

/**
 * 字体清单与 @font-face 生成 —— 唯一真相源。
 *
 * 背景：早期字体声明散落在两处（src/fonts/fonts.css 供 UI、htmlGenerator.ts
 * 内联模板供预览/导出），导致 9 个字体文件被 vite 复制进 asar（12.98 MB）
 * 又被 extraResources 复制进 resources（12.99 MB），包体里存在两份。
 * 现在统一由本模块生成：UI 主窗口、预览 iframe、导出 HTML 三处共用同一函数。
 *
 * 字体文件只保留一份 —— 打包后位于 resources/fonts（真实文件系统，不在 asar 内），
 * 由 electron-builder 的 extraResources 从 src/fonts 复制而来；该目录随安装包只读。
 *
 * 扩展预留：将来接入「用户自定义字体」时，只需新增 getUserFontFamilies()
 * 扫描 userData/fonts，与 getBuiltinFontFamilies() 合并后传给 buildFontFaceCss()，
 * 本文件的生成逻辑无需改动。
 */

/** 单个字重/字形对应的字体文件 */
export interface FontFaceFile {
  /** 文件名（相对所在字体目录） */
  file: string;
  /** 字重：数值（300/400/700）或关键字 */
  weight: number | 'normal' | 'bold';
  style: 'normal' | 'italic';
  format: 'woff2' | 'truetype';
}

/** 一个字体族 */
export interface FontFamilyDef {
  /** CSS font-family 名称 */
  family: string;
  /** 来源：内置（随安装包）或用户自定义（userData/fonts，待实现） */
  source: 'builtin' | 'user';
  /** 该族字体文件所在目录的 URL，结尾带 / */
  dirUrl: string;
  files: FontFaceFile[];
}

type RuntimeEnvironment =
  | { type: 'browser-http' }
  | { type: 'electron-dev'; fontsDir: string }
  | { type: 'electron-prod'; appUrl: string }
  | { type: 'fallback' };

function detectEnvironment(): RuntimeEnvironment {
  const protocol = window.location.protocol;

  if (protocol === 'http:' || protocol === 'https:') {
    return { type: 'browser-http' };
  }

  if (protocol === 'file:') {
    const appUrl = window.location.href;
    if (appUrl.includes('src/renderer')) {
      return { type: 'electron-dev', fontsDir: __FONTS_DIR__.replace(/\\/g, '/') };
    }
    return { type: 'electron-prod', appUrl };
  }

  return { type: 'fallback' };
}

/**
 * 内置字体目录的 URL。
 *
 * - electron-prod：打包后 index.html 位于 app.asar/dist/renderer/，
 *   字体在同级 resources/fonts（extraResources 目标），故把 app.asar 之后的路径整体替换。
 * - electron-dev：直接使用 vite define 注入的 src/fonts 绝对路径。
 * - browser-http：vite dev server 场景，经 /@fs/ 直连项目内 src/fonts
 *   （server.fs.allow 默认包含项目根目录）。
 */
export function getBuiltinFontsDirUrl(): string {
  const env = detectEnvironment();

  switch (env.type) {
    case 'browser-http':
      return `${window.location.origin}/@fs/${__FONTS_DIR__.replace(/\\/g, '/')}/`;
    case 'electron-dev':
      return `file:///${env.fontsDir}/`;
    case 'electron-prod':
      return env.appUrl.replace(/app\.asar\/.*$/, 'fonts/');
    case 'fallback':
      return `file:///${__FONTS_DIR__.replace(/\\/g, '/')}/`;
  }
}

/** 内置字体清单（原 src/fonts/fonts.css 的 9 条 @font-face 迁移至此） */
export function getBuiltinFontFamilies(): FontFamilyDef[] {
  const dirUrl = getBuiltinFontsDirUrl();

  return [
    {
      family: 'GWM Sans UI',
      source: 'builtin',
      dirUrl,
      files: [
        { file: 'GWMSansUI-Regular.woff2', weight: 'normal', style: 'normal', format: 'woff2' },
        { file: 'GWMSansUI-Bold.woff2', weight: 'bold', style: 'normal', format: 'woff2' },
        { file: 'GWMSansUI-Light.woff2', weight: 300, style: 'normal', format: 'woff2' },
      ],
    },
    {
      family: 'JetBrains Mono',
      source: 'builtin',
      dirUrl,
      files: [
        { file: 'JetBrainsMono-Regular.woff2', weight: 'normal', style: 'normal', format: 'woff2' },
        { file: 'JetBrainsMono-Bold.woff2', weight: 'bold', style: 'normal', format: 'woff2' },
        { file: 'JetBrainsMono-Light.woff2', weight: 300, style: 'normal', format: 'woff2' },
      ],
    },
    // TrueType 轮廓：避免 CFF 轮廓在 printToPDF 中产生 T3Font（见原 fonts.css 注释）
    {
      family: 'Monaspace Argon',
      source: 'builtin',
      dirUrl,
      files: [
        { file: 'MonaspaceArgonFrozen-Regular.ttf', weight: 'normal', style: 'normal', format: 'truetype' },
        { file: 'MonaspaceArgonFrozen-Bold.ttf', weight: 'bold', style: 'normal', format: 'truetype' },
        { file: 'MonaspaceArgonFrozen-Light.ttf', weight: 300, style: 'normal', format: 'truetype' },
      ],
    },
  ];
}

/**
 * 生成 @font-face CSS。
 *
 * 三处消费者共用：主窗口 UI、预览 iframe、导出 HTML。
 * 每个字体族自带 dirUrl，因此内置字体与（将来的）用户字体可以混合传入而无需分支。
 *
 * font-display: block —— 导出 PDF 时浏览器可能在字体就绪前就开始打印，
 * swap 会先用回退字体排版，导致分页测量与实际字形不一致。
 */
export function buildFontFaceCss(families: FontFamilyDef[]): string {
  return families
    .flatMap((family) =>
      family.files.map(
        ({ file, weight, style, format }) =>
          `@font-face{font-family:'${family.family}';` +
          `src:url('${family.dirUrl}${file}') format('${format}');` +
          `font-weight:${weight};font-style:${style};font-display:block;}`
      )
    )
    .join('\n');
}

/**
 * 向主窗口注入 @font-face，替代原 styles/variables.css 里的 `@import '../../fonts/fonts.css'`。
 *
 * 该 @import 会让 vite 把 9 个字体文件复制进 asar（12.98 MB），
 * 而生产运行时实际用的是 resources/fonts，等于字体在包里存了两份。
 * 改为运行时注入后，字体只保留 resources/fonts 一份。
 */
export function injectAppFontFaces(): void {
  if (document.querySelector('style[data-aimtp-app-fonts]')) return;

  const style = document.createElement('style');
  style.setAttribute('data-aimtp-app-fonts', '');
  style.textContent = buildFontFaceCss(getBuiltinFontFamilies());
  document.head.prepend(style);
}
