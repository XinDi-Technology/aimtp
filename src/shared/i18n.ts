/**
 * i18n — 全项目唯一文案真源（中文 / English）
 *
 * 结构：按模块嵌套分组，zh 为结构真源，en 用 `typeof zh` 约束，
 * 中英文案缺 key / 多 key / key 拼错都会在 tsc 阶段报错。
 *
 * 两组使用方式：
 * 1. 渲染进程（React）：const { t } = useI18n(); t.settings.page.margins
 * 2. 主进程或动态 key：t('errors.templateInvalidId', locale)
 *
 * 注意：界面语言（locale）只影响界面文案，不影响导入文档的排版语言，
 * 文档内容（标题、日期等）一律由文档作者提供，缺失时抛错误码 errors.*，
 * 由渲染层翻译后提示，应用不编造任何兜底文案。
 */

const zh = {
  /** 主进程抛出的错误文案（IPC 返回给渲染层展示） */
  errors: {
    fileWriteError: '写入文件失败',
    pdfGenerationError: 'PDF生成失败',
    templateInvalidId: '模板 ID 不合法',
    templateInvalidName: '模板名称不能为空',
    templateWriteError: '模板写入失败',
    previewNotReady: '预览尚未渲染完成，请稍候再试',
    saveCancelled: '已取消保存',
    unknownError: '未知错误',
    coverTitleMissing: '启用封面需要文档标题：请在 YAML Front Matter 中写 title，或在正文开头写一个 H1 标题。',
    headerFooterTitleMissing: '页眉/页脚选择了「标题」，但文档没有标题：请在 YAML Front Matter 中写 title，或在正文开头写一个 H1 标题。',
    coverDateMissing: '启用封面需要文档日期：请在 YAML Front Matter 中写 date（如 date: 2026-10-09）。',
  },
  toolbar: {
    importFile: '导入文件',
    language: '语言',
    template: '模板',
    closeTemplate: '关闭',
    closeTemplateTitle: '关闭模板选择',
    exportPdf: '导出 PDF',
    generating: '生成中...',
    export: '导出',
    themeToDark: '切换到暗色模式',
    themeToLight: '切换到浅色模式',
  },
  app: {
    preview: '预览',
    templateSelection: '模板选择',
  },
  statusBar: {
    untitled: '未命名.md',
    words: '字数',
    lines: '行数',
    templateBlank: '空白文档',
    templateReport: '项目报告',
    templateArticle: '文章',
    templateDocumentation: 'API文档',
  },
  templatePanel: {
    preset: '预设模板',
    custom: '自定义模板',
    select: '选择',
    createdAt: '创建于',
    delete: '删除',
    zhTechName: '中文技术文档',
    zhTechDesc: '含设置说明与排版示例，默认 A4 / 18px / 行高 2',
  },
  preview: {
    loadingFonts: '加载字体...',
    preparingDocument: '准备文档...',
    injectingEngine: '注入排版引擎...',
    paginating: '分页中',
    rendering: '分页渲染中...',
    renderingFallback: '渲染中...',
    renderedPages: '已渲染 {n} 页',
  },
  errorBoundary: {
    criticalTitle: '严重错误',
    errorTitle: '出现错误',
    criticalMessage: '检测到多次错误，请刷新页面。',
    message: '发生了意外错误，可重试或刷新页面。',
    details: '错误详情：',
    tryAgain: '重试',
    refresh: '刷新页面',
  },
  settings: {
    title: '设置',
    page: {
      title: '页面设置',
      size: '页面尺寸',
      orientation: '页面方向',
      orientationPortrait: '纵向',
      orientationLandscape: '横向',
      margins: '页边距 (mm)',
      marginTop: '上',
      marginBottom: '下',
      marginLeft: '左',
      marginRight: '右',
    },
    font: {
      title: '字体设置',
      body: '正文字体',
      code: '代码字体',
      baseSize: '基础字号',
      lineHeight: '行高',
      paragraphSpacing: '段落间距',
    },
    extensions: {
      title: '扩展功能',
      githubAlerts: 'GitHub 风格警告框',
      codeHighlight: '代码高亮',
      codeTheme: '代码高亮主题',
      taskLists: '待办事项',
      footnotes: '脚注',
      footnotePosition: '脚注位置',
      footnoteEnd: '文档末尾',
      footnotePageBottom: '当前页底部',
      pageBreak: '分页设置',
      h1PageBreak: '按 H1 标题自动分页',
      h2PageBreak: '按 H2 标题自动分页',
      showLineNumbers: '显示代码行号',
      mermaid: 'Mermaid 图表',
      mathJax: 'MathJax 数学公式',
      mark: '高亮标记 (==text==)',
      ins: '下划线插入 (++text++)',
      sub: '下标 (H~2~O)',
      sup: '上标 (E=mc^2^)',
    },
    frontMatter: {
      title: '以下设置需要 YAML Front Matter',
      hint: '💡 目前支持以下格式：',
    },
    cover: {
      title: '封面设置',
      enabled: '封面',
    },
    headerFooter: {
      title: '页眉页脚',
      enabled: '页眉页脚',
      headerSettings: '页眉设置',
      footerSettings: '页脚设置',
      font: '字体',
      alignment: '对齐方式',
      alignLeft: '左对齐',
      alignCenter: '居中',
      alignRight: '右对齐',
      content: '内容',
      contentTitle: '标题',
      contentAuthor: '作者',
      contentDate: '日期',
      contentNone: '不显示',
      contentPageNumber: '页码',
      contentPageNumberTotal: '第x页/共x页',
    },
    preview: {
      title: '预览页面尺寸校准',
      dpi: 'DPI',
    },
    actions: {
      saveAsTemplate: '保存设置为模板',
      openTemplateDir: '打开模板目录',
      templateDirPrefix: '模板保存在：',
      clearPersonalData: '清除所有个人数据',
    },
    modal: {
      saveTemplateTitle: '保存设置为模板',
      templateName: '模板名称',
      templateNamePlaceholder: '请输入模板名称',
      cancel: '取消',
      save: '保存',
      clearDataTitle: '清除所有个人数据',
      clearDataMessage: '将删除磁盘上的全部自定义模板',
      clearDataMessageSuffix: '，并重置界面设置。此操作不可撤销。',
      confirmClear: '确认清除',
    },
  },
  common: {
    readFileFailed: '读取文件失败：',
    exportFailed: 'PDF 导出失败',
    exportFailedDetail: 'PDF 导出失败，请查看控制台获取详细信息',
  },
  menu: {
    file: '文件',
    view: '视图',
    help: '帮助',
    quit: '退出',
    toggleDevTools: '开发者工具',
    about: '关于 Aimtp',
    aboutDetail: 'Aimtp 是一款 Markdown 转 PDF 的排版工具。',
  },
};

const en: typeof zh = {
  errors: {
    fileWriteError: 'Failed to write file',
    pdfGenerationError: 'PDF generation failed',
    templateInvalidId: 'Invalid template id',
    templateInvalidName: 'Template name cannot be empty',
    templateWriteError: 'Failed to write template',
    previewNotReady: 'Preview is still rendering, please try again in a moment',
    saveCancelled: 'Save cancelled',
    unknownError: 'Unknown error',
    coverTitleMissing: 'Cover requires a document title: add "title" in YAML front matter, or start the document with an H1 heading.',
    headerFooterTitleMissing: 'Header/footer is set to "Title", but the document has no title: add "title" in YAML front matter, or start the document with an H1 heading.',
    coverDateMissing: 'Cover requires a document date: add "date" in YAML front matter (e.g. date: 2026-10-09).',
  },
  toolbar: {
    importFile: 'Import',
    language: 'Language',
    template: 'Template',
    closeTemplate: 'Close',
    closeTemplateTitle: 'Close Template Selection',
    exportPdf: 'Export PDF',
    generating: 'Generating...',
    export: 'Export',
    themeToDark: 'Switch to Dark Mode',
    themeToLight: 'Switch to Light Mode',
  },
  app: {
    preview: 'Preview',
    templateSelection: 'Template Selection',
  },
  statusBar: {
    untitled: 'Untitled.md',
    words: 'Words',
    lines: 'Lines',
    templateBlank: 'Blank Document',
    templateReport: 'Project Report',
    templateArticle: 'Article',
    templateDocumentation: 'API Documentation',
  },
  templatePanel: {
    preset: 'Preset Templates',
    custom: 'Custom Templates',
    select: 'Select',
    createdAt: 'Created',
    delete: 'Delete',
    zhTechName: 'Chinese Technical Doc',
    zhTechDesc: 'With settings notes and typography samples, A4 / 18px / line-height 2',
  },
  preview: {
    loadingFonts: 'Loading fonts...',
    preparingDocument: 'Preparing document...',
    injectingEngine: 'Injecting layout engine...',
    paginating: 'Paginating',
    rendering: 'Paginating...',
    renderingFallback: 'Rendering...',
    renderedPages: '{n} pages rendered',
  },
  errorBoundary: {
    criticalTitle: 'Critical Error',
    errorTitle: 'Something went wrong',
    criticalMessage: 'Multiple errors detected. Please refresh the page.',
    message: 'An unexpected error occurred. Try again or refresh the page.',
    details: 'Error Details:',
    tryAgain: 'Try Again',
    refresh: 'Refresh Page',
  },
  settings: {
    title: 'Settings',
    page: {
      title: 'Page Settings',
      size: 'Page Size',
      orientation: 'Orientation',
      orientationPortrait: 'Portrait',
      orientationLandscape: 'Landscape',
      margins: 'Margins (mm)',
      marginTop: 'Top',
      marginBottom: 'Bottom',
      marginLeft: 'Left',
      marginRight: 'Right',
    },
    font: {
      title: 'Font Settings',
      body: 'Body Font',
      code: 'Code Font',
      baseSize: 'Base Font Size',
      lineHeight: 'Line Height',
      paragraphSpacing: 'Paragraph Spacing',
    },
    extensions: {
      title: 'Extensions',
      githubAlerts: 'GitHub Style Alerts',
      codeHighlight: 'Code Highlight',
      codeTheme: 'Code Highlight Theme',
      taskLists: 'Task Lists',
      footnotes: 'Footnotes',
      footnotePosition: 'Footnote Position',
      footnoteEnd: 'End of Document',
      footnotePageBottom: 'Bottom of Page',
      pageBreak: 'Page Break',
      h1PageBreak: 'Page break before H1',
      h2PageBreak: 'Page break before H2',
      showLineNumbers: 'Show Code Line Numbers',
      mermaid: 'Mermaid Diagrams',
      mathJax: 'MathJax Formulas',
      mark: 'Highlight (==text==)',
      ins: 'Insert (++text++)',
      sub: 'Subscript (H~2~O)',
      sup: 'Superscript (E=mc^2^)',
    },
    frontMatter: {
      title: 'These settings require YAML Front Matter',
      hint: '💡 Supported format:',
    },
    cover: {
      title: 'Cover Settings',
      enabled: 'Cover',
    },
    headerFooter: {
      title: 'Header & Footer',
      enabled: 'Header & Footer',
      headerSettings: 'Header Settings',
      footerSettings: 'Footer Settings',
      font: 'Font',
      alignment: 'Alignment',
      alignLeft: 'Left',
      alignCenter: 'Center',
      alignRight: 'Right',
      content: 'Content',
      contentTitle: 'Title',
      contentAuthor: 'Author',
      contentDate: 'Date',
      contentNone: 'None',
      contentPageNumber: 'Page Number',
      contentPageNumberTotal: 'Page x of y',
    },
    preview: {
      title: 'Preview Calibration',
      dpi: 'DPI',
    },
    actions: {
      saveAsTemplate: 'Save as Template',
      openTemplateDir: 'Open Template Directory',
      templateDirPrefix: 'Templates saved in: ',
      clearPersonalData: 'Clear All Personal Data',
    },
    modal: {
      saveTemplateTitle: 'Save as Template',
      templateName: 'Template Name',
      templateNamePlaceholder: 'Enter template name',
      cancel: 'Cancel',
      save: 'Save',
      clearDataTitle: 'Clear All Personal Data',
      clearDataMessage: 'All custom templates on disk will be deleted',
      clearDataMessageSuffix: ', and interface settings will be reset. This action cannot be undone.',
      confirmClear: 'Confirm Clear',
    },
  },
  common: {
    readFileFailed: 'Failed to read file: ',
    exportFailed: 'PDF export failed',
    exportFailedDetail: 'PDF export failed. See the console for details.',
  },
  menu: {
    file: 'File',
    view: 'View',
    help: 'Help',
    quit: 'Quit',
    toggleDevTools: 'Developer Tools',
    about: 'About Aimtp',
    aboutDetail: 'Aimtp is a Markdown to PDF typesetting tool.',
  },
};

export type Locale = 'zh' | 'en';

/** 文案字典（嵌套结构） */
export const translations = { zh, en };

/** 单语言文案类型（供渲染层 useI18n 使用） */
export type Translations = typeof zh;

/** 取指定语言的完整文案对象 */
export function getTranslations(locale: Locale): Translations {
  return translations[locale];
}

/**
 * 按点号路径取文案，如 t('errors.templateInvalidId', 'en')
 * 供主进程 / 动态 key 场景使用；找不到时回退到英文，再找不到返回路径本身。
 */
export function t(path: string, locale: Locale = 'zh'): string {
  const lookup = (loc: Locale): string | undefined => {
    const value = path.split('.').reduce<unknown>(
      (acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
      translations[loc],
    );
    return typeof value === 'string' ? value : undefined;
  };
  return lookup(locale) ?? lookup('en') ?? path;
}

/** 错误码前缀：主进程只抛错误码，由渲染层按界面语言翻译后再展示 */
const ERROR_CODE_PREFIX = 'errors.';

/** 判断一个字符串是否为错误码（形如 'errors.xxx'） */
export function isErrorCode(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(ERROR_CODE_PREFIX);
}
