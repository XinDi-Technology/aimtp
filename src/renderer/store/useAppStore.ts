import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { logger } from '../utils/logger';

// 应用主题
const applyTheme = (theme: 'light' | 'dark' | 'system') => {
  const root = document.documentElement;
  
  if (theme === 'system') {
    // 检测系统主题
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
};

// 监听系统主题变化
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const store = useAppStore.getState();
    if (store.theme === 'system') {
      applyTheme('system');
    }
  });
}

export interface PageSettings {
  size: 'A4' | 'A3';
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export interface FontSettings {
  body: string;
  code: string;
  baseSize: number;
  lineHeight: number;
  paragraphSpacing: number;
}

export interface ExtensionSettings {
  githubAlerts: boolean;
  codeHighlight: boolean;
  codeTheme: string;
  showLineNumbers: boolean;
  taskLists: boolean;
  mermaid: boolean;
  mathJax: boolean;
  footnotes: boolean;
  footnoteMode: 'end' | 'page-bottom';
  h1PageBreak: boolean;
  h2PageBreak: boolean;
  mark: boolean;
  ins: boolean;
  sub: boolean;
  sup: boolean;
}

export interface CoverSettings {
  enabled: boolean; // 是否启用封面，元数据从 Front Matter 自动提取
}

export interface HeaderFooterSettings {
  enabled: boolean;
  header: {
    font: string;
    alignment: 'left' | 'center' | 'right';
    content: string;
  };
  footer: {
    font: string;
    alignment: 'left' | 'center' | 'right';
    content: 'pageNumber' | 'pageNumberTotal' | string;
  };
}

export interface TemplateSettings {
  page: PageSettings;
  font: FontSettings;
  extensions: ExtensionSettings;
  headerFooter: HeaderFooterSettings;
  cover: CoverSettings;
}

export interface CustomTemplate {
  id: string;
  name: string;
  settings: TemplateSettings;
  createdAt: number;
}

export interface PreviewSettings {
  targetDPI: number; // 目标 DPI（默认 96）
}

/** 设置变更分类 — 与 SettingChangeClassifier 对齐 */
export type SettingChangeCategory = 'visual-only' | 'layout-change' | 'content-change';

export interface AppState {
  markdown: string;
  setMarkdown: (markdown: string) => void;

  /** 导入文件时自增：内容未变也要强制触发一次完整重渲染。
   *  不加入 persist 白名单，重启后从 0 开始。 */
  renderNonce: number;
  bumpRenderNonce: () => void;
  
  currentTemplate: string;
  setCurrentTemplate: (template: string) => void;
  
  locale: 'zh' | 'en';
  setLocale: (locale: 'zh' | 'en') => void;
  
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  
  page: PageSettings;
  setPage: (page: Partial<PageSettings>) => void;
  
  font: FontSettings;
  setFont: (font: Partial<FontSettings>) => void;
  
  extensions: ExtensionSettings;
  setExtensions: (extensions: Partial<ExtensionSettings>) => void;
  
  cover: CoverSettings;
  setCover: (cover: Partial<CoverSettings>) => void;
  
  headerFooter: HeaderFooterSettings;
  setHeaderFooter: (headerFooter: Partial<HeaderFooterSettings>) => void;
  
  preview: PreviewSettings;
  setPreview: (preview: Partial<PreviewSettings>) => void;
  
  isGenerating: boolean;
  setIsGenerating: (isGenerating: boolean) => void;
  
  showTemplateSelection: boolean;
  setShowTemplateSelection: (show: boolean) => void;
  
  customTemplates: CustomTemplate[];
  saveAsTemplate: (name: string) => void;
  applyTemplate: (templateId: string) => void;
  deleteTemplate: (templateId: string) => void;
  
  selectPresetTemplate: (templateKey: string) => void;
}

/** 预设模板：完整设置（正文由内置 MD 文件提供，见主进程 app:request-default-doc） */
export interface PresetTemplate {
  settings: {
    page: PageSettings;
    font: FontSettings;
    extensions: ExtensionSettings;
    headerFooter: HeaderFooterSettings;
    cover: CoverSettings;
    preview: PreviewSettings;
  };
}

// 预设模板目前只保留「中文技术文档」一个。
// 它的 settings 同时是应用默认值（defaultPage/defaultFont/...）的唯一来源，
// 避免「模板里一套、默认值另一套」的两处维护。
export const TEMPLATES: Record<'zhTech', PresetTemplate> = {
  zhTech: {
    settings: {
      page: {
        size: 'A4',
        orientation: 'portrait',
        margins: { top: 20, bottom: 20, left: 24, right: 24 },
      },
      font: {
        body: 'GWM Sans UI',
        code: 'JetBrains Mono',
        baseSize: 18,
        lineHeight: 2,
        paragraphSpacing: 0.5,
      },
      extensions: {
        githubAlerts: true,
        codeHighlight: true,
        codeTheme: 'github',
        showLineNumbers: true,
        taskLists: true,
        mermaid: true,
        mathJax: true,
        footnotes: true,
        footnoteMode: 'end',
        h1PageBreak: false,
        h2PageBreak: true,
        mark: true,
        ins: true,
        sub: true,
        sup: true,
      },
      headerFooter: {
        enabled: true,
        header: { font: 'GWM Sans UI', alignment: 'center', content: 'title' },
        footer: { font: 'GWM Sans UI', alignment: 'center', content: 'pageNumberTotal' },
      },
      cover: { enabled: true },
      preview: { targetDPI: 93 },
    },
  },
};

// 应用默认值的唯一来源：内置预设模板「中文技术文档」的 settings。
// 用深拷贝取值，避免下游代码（如 setPage 的浅合并）意外改动 TEMPLATES 常量本身。
const clonePreset = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const defaultPage: PageSettings = clonePreset(TEMPLATES.zhTech.settings.page);

const defaultFont: FontSettings = clonePreset(TEMPLATES.zhTech.settings.font);

const defaultExtensions: ExtensionSettings = clonePreset(TEMPLATES.zhTech.settings.extensions);

const defaultCover: CoverSettings = clonePreset(TEMPLATES.zhTech.settings.cover);

const defaultHeaderFooter: HeaderFooterSettings = clonePreset(TEMPLATES.zhTech.settings.headerFooter);

const defaultPreview: PreviewSettings = clonePreset(TEMPLATES.zhTech.settings.preview);

const STORAGE_KEY = 'aimtp-custom-templates';

const isValidPageSize = (size: unknown): size is PageSettings['size'] => {
  return size === 'A4' || size === 'A3';
};

const isValidOrientation = (orientation: unknown): orientation is PageSettings['orientation'] => {
  return orientation === 'portrait' || orientation === 'landscape';
};

const isValidAlignment = (alignment: unknown): alignment is 'left' | 'center' | 'right' => {
  return alignment === 'left' || alignment === 'center' || alignment === 'right';
};

const isValidNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
};

const isValidString = (value: unknown): value is string => {
  return typeof value === 'string';
};

const isValidBoolean = (value: unknown): value is boolean => {
  return typeof value === 'boolean';
};

const isValidFootnoteMode = (value: unknown): value is 'end' | 'page-bottom' => {
  return value === 'end' || value === 'page-bottom';
};

const validatePageSettings = (data: unknown): PageSettings => {
  const defaults = { ...defaultPage };
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const m = (d.margins && typeof d.margins === 'object' ? d.margins : {}) as Record<string, unknown>;

  return {
    size: isValidPageSize(d.size) ? d.size : defaults.size,
    orientation: isValidOrientation(d.orientation) ? d.orientation : defaults.orientation,
    margins: {
      top: isValidNumber(m.top) ? m.top : defaults.margins.top,
      bottom: isValidNumber(m.bottom) ? m.bottom : defaults.margins.bottom,
      left: isValidNumber(m.left) ? m.left : defaults.margins.left,
      right: isValidNumber(m.right) ? m.right : defaults.margins.right,
    },
  };
};

const validateFontSettings = (data: unknown): FontSettings => {
  const defaults = { ...defaultFont };
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;

  return {
    body: isValidString(d.body) ? d.body : defaults.body,
    code: isValidString(d.code) ? d.code : defaults.code,
    baseSize: isValidNumber(d.baseSize) ? d.baseSize : defaults.baseSize,
    lineHeight: isValidNumber(d.lineHeight) ? d.lineHeight : defaults.lineHeight,
    paragraphSpacing: isValidNumber(d.paragraphSpacing) ? d.paragraphSpacing : defaults.paragraphSpacing,
  };
};

const validateExtensionSettings = (data: unknown): ExtensionSettings => {
  const defaults = { ...defaultExtensions };
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;

  return {
    githubAlerts: isValidBoolean(d.githubAlerts) ? d.githubAlerts : defaults.githubAlerts,
    codeHighlight: isValidBoolean(d.codeHighlight) ? d.codeHighlight : defaults.codeHighlight,
    codeTheme: isValidString(d.codeTheme) ? d.codeTheme : defaults.codeTheme,
    showLineNumbers: isValidBoolean(d.showLineNumbers) ? d.showLineNumbers : defaults.showLineNumbers,
    taskLists: isValidBoolean(d.taskLists) ? d.taskLists : defaults.taskLists,
    mermaid: isValidBoolean(d.mermaid) ? d.mermaid : defaults.mermaid,
    // 兼容旧版本的 katex 设置
    mathJax: isValidBoolean(d.mathJax) ? d.mathJax : (isValidBoolean(d.katex) ? d.katex : defaults.mathJax),
    footnotes: isValidBoolean(d.footnotes) ? d.footnotes : defaults.footnotes,
    footnoteMode: isValidFootnoteMode(d.footnoteMode) ? d.footnoteMode : defaults.footnoteMode,
    h1PageBreak: isValidBoolean(d.h1PageBreak) ? d.h1PageBreak : defaults.h1PageBreak,
    h2PageBreak: isValidBoolean(d.h2PageBreak) ? d.h2PageBreak : defaults.h2PageBreak,
    mark: isValidBoolean(d.mark) ? d.mark : defaults.mark,
    ins: isValidBoolean(d.ins) ? d.ins : defaults.ins,
    sub: isValidBoolean(d.sub) ? d.sub : defaults.sub,
    sup: isValidBoolean(d.sup) ? d.sup : defaults.sup,
  };
};

const validateCoverSettings = (data: unknown): CoverSettings => {
  const defaults = { ...defaultCover };
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;

  return {
    enabled: isValidBoolean(d.enabled) ? d.enabled : defaults.enabled,
  };
};

const validateHeaderFooterSettings = (data: unknown): HeaderFooterSettings => {
  const defaults = { ...defaultHeaderFooter };
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const h = (d.header && typeof d.header === 'object' ? d.header : {}) as Record<string, unknown>;
  const f = (d.footer && typeof d.footer === 'object' ? d.footer : {}) as Record<string, unknown>;

  return {
    enabled: isValidBoolean(d.enabled) ? d.enabled : defaults.enabled,
    header: {
      font: isValidString(h.font) ? h.font : defaults.header.font,
      alignment: isValidAlignment(h.alignment) ? h.alignment : defaults.header.alignment,
      content: isValidString(h.content) ? h.content : defaults.header.content,
    },
    footer: {
      font: isValidString(f.font) ? f.font : defaults.footer.font,
      alignment: isValidAlignment(f.alignment) ? f.alignment : defaults.footer.alignment,
      content: isValidString(f.content) ? f.content : defaults.footer.content,
    },
  };
};

const validatePreviewSettings = (data: unknown): PreviewSettings => {
  const defaults = { ...defaultPreview };
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;

  let targetDPI = defaults.targetDPI;
  if (isValidNumber(d.targetDPI)) {
    targetDPI = Math.max(48, Math.min(480, d.targetDPI)); // 限制范围 48-480
  }

  return { targetDPI };
};

const validateTemplateSettings = (data: unknown): TemplateSettings => {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;

  return {
    page: validatePageSettings(d.page),
    font: validateFontSettings(d.font),
    extensions: validateExtensionSettings(d.extensions),
    headerFooter: validateHeaderFooterSettings(d.headerFooter),
    cover: validateCoverSettings(d.cover),
  };
};

const validateCustomTemplate = (data: unknown): CustomTemplate | null => {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  if (!isValidString(d.id) || !isValidString(d.name) || !isValidNumber(d.createdAt)) {
    return null;
  }

  return {
    id: d.id,
    name: d.name,
    settings: validateTemplateSettings(d.settings),
    createdAt: d.createdAt,
  };
};

const validateCustomTemplates = (data: unknown): CustomTemplate[] => {
  if (!Array.isArray(data)) return [];

  return data
    .map(validateCustomTemplate)
    .filter((template): template is CustomTemplate => template !== null);
};

const localStorageAvailable = (): boolean => {
  try {
    const key = '__aimtp_storage_test__';
    localStorage.setItem(key, key);
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

// 非 Electron 环境（如纯浏览器测试）下没有该 API，此时退回 localStorage 读写。
const templatesApi = () => window.electronAPI?.templates;

/** 读取历史上存在 localStorage 里的自定义模板（仅用于一次性迁移与兜底） */
const readLegacyCustomTemplates = (): CustomTemplate[] => {
  if (!localStorageAvailable()) return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    const validated = validateCustomTemplates(parsed);
    if (validated.length !== parsed.length) {
      logger.warn('Some templates were invalid and discarded during loading');
    }
    return validated;
  } catch (error) {
    logger.error('Failed to load legacy custom templates:', error);
    return [];
  }
};

const clearLegacyCustomTemplates = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    logger.warn('Failed to clear legacy custom templates:', error);
  }
};

/**
 * 从磁盘目录（userData/templates）读取自定义模板。
 * 目录为空时，把 localStorage 里的历史数据迁移到磁盘（一次性），
 * 迁移成功后清掉 localStorage 中的旧副本，避免下次又迁回来。
 */
export const loadCustomTemplates = async (): Promise<CustomTemplate[]> => {
  const api = templatesApi();
  if (!api) {
    // 没有主进程 API 时沿用旧行为，保证测试/纯浏览器环境仍可用
    return readLegacyCustomTemplates();
  }

  try {
    const records = await api.list();
    const validated = validateCustomTemplates(records);
    if (validated.length > 0) {
      return validated;
    }

    const legacy = readLegacyCustomTemplates();
    if (legacy.length === 0) return [];

    for (const template of legacy) {
      try {
        await api.save(template);
      } catch (error) {
        logger.error('Failed to migrate template to disk:', template.id, error);
      }
    }
    clearLegacyCustomTemplates();
    logger.log(`Migrated ${legacy.length} custom template(s) to disk`);
    return legacy;
  } catch (error) {
    logger.error('Failed to load custom templates from disk:', error);
    return readLegacyCustomTemplates();
  }
};

/** 把单个模板写入磁盘（新增与更新都走这里） */
const persistTemplate = async (template: CustomTemplate): Promise<void> => {
  const api = templatesApi();
  if (!api) {
    logger.warn('Template file API is not available, cannot save template');
    return;
  }
  try {
    await api.save(template);
  } catch (error) {
    logger.error('Failed to save custom template:', error);
  }
};

const persistTemplateRemoval = async (id: string): Promise<void> => {
  const api = templatesApi();
  if (!api) return;
  try {
    await api.remove(id);
  } catch (error) {
    logger.error('Failed to remove custom template:', error);
  }
};

/** 「清除所有个人数据」：删除磁盘上的全部模板文件 */
export const clearAllCustomTemplates = async (): Promise<void> => {
  clearLegacyCustomTemplates();
  const api = templatesApi();
  if (!api) return;
  try {
    await api.clear();
  } catch (error) {
    logger.error('Failed to clear custom templates:', error);
  }
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      markdown: '',
      setMarkdown: (markdown) => set({ markdown }),

      renderNonce: 0,
      bumpRenderNonce: () => set((s) => ({ renderNonce: s.renderNonce + 1 })),
      
      currentTemplate: 'zhTech',
      setCurrentTemplate: (currentTemplate) => set({ currentTemplate }),
      
      locale: 'zh',
      setLocale: (locale) => set({ locale }),
      
      theme: 'light', // 默认浅色主题
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      
      page: defaultPage,
      setPage: (page) => set((state) => ({ page: { ...state.page, ...page } })),
      
      font: defaultFont,
      setFont: (font) => set((state) => ({ font: { ...state.font, ...font } })),
      
      extensions: defaultExtensions,
      setExtensions: (extensions) => set((state) => ({ extensions: { ...state.extensions, ...extensions } })),
      
      cover: defaultCover,
      setCover: (cover) => set((state) => ({ cover: { ...state.cover, ...cover } })),
      
      headerFooter: defaultHeaderFooter,
      setHeaderFooter: (headerFooter) => set((state) => ({ headerFooter: { ...state.headerFooter, ...headerFooter } })),
      
      preview: defaultPreview,
      setPreview: (preview) => set((state) => ({ preview: { ...state.preview, ...preview } })),
      
      isGenerating: false,
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      
      showTemplateSelection: false,
      setShowTemplateSelection: (show) => set({ showTemplateSelection: show }),
      
      // 自定义模板来自磁盘目录，由下方 loadCustomTemplates() 异步填充
      customTemplates: [],
      
      saveAsTemplate: (name) => {
        const trimmedName = name?.trim();
        
        if (!trimmedName) {
          logger.warn('Template name cannot be empty');
          return;
        }
        
        if (trimmedName.length > 100) {
          logger.warn('Template name is too long (max 100 characters)');
          return;
        }
        
        const state = get();
        const newTemplate: CustomTemplate = {
          id: Date.now().toString(),
          name: trimmedName,
          settings: {
            page: { ...state.page },
            font: { ...state.font },
            extensions: { ...state.extensions },
            headerFooter: { ...state.headerFooter },
            cover: { ...state.cover },
          },
          createdAt: Date.now(),
        };
        const newTemplates = [...state.customTemplates, newTemplate];
        void persistTemplate(newTemplate);
        set({
          customTemplates: newTemplates,
        });
      },
      
      applyTemplate: (templateId) => {
        const state = get();
        const template = state.customTemplates.find(t => t.id === templateId);
        if (template) {
          set({
            // 用户自存模板只应用设置，正文重置为空白页
            markdown: '',
            page: { ...template.settings.page },
            font: { ...template.settings.font },
            extensions: { ...template.settings.extensions },
            headerFooter: { ...template.settings.headerFooter },
            cover: { ...template.settings.cover },
            showTemplateSelection: false,
          });
        }
      },
      
      deleteTemplate: (templateId) => {
        const state = get();
        const newTemplates = state.customTemplates.filter(t => t.id !== templateId);
        void persistTemplateRemoval(templateId);
        set({
          customTemplates: newTemplates,
        });
      },
      
      selectPresetTemplate: (templateKey) => {
        const template = TEMPLATES[templateKey as keyof typeof TEMPLATES];
        if (template) {
          const { page, font, extensions, headerFooter, cover, preview } = template.settings;
          set({
            currentTemplate: templateKey,
            // 预设模板自带一套完整设置，选择模板即应用这套设置（含目标 DPI）
            page: clonePreset(page),
            font: clonePreset(font),
            extensions: clonePreset(extensions),
            headerFooter: clonePreset(headerFooter),
            cover: clonePreset(cover),
            preview: clonePreset(preview),
            showTemplateSelection: false, // 关闭模板选择面板
          });
          // 正文从内置 MD 文件载入（单一内容源），而非内联字符串
          window.electronAPI?.requestDefaultDoc?.();
        }
      },
    }),
    {
      name: 'aimtp-app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // 刻意不持久化 markdown：启动时始终回到默认模板，
        // 避免打开软件就渲染上次导入的文件内容。
        locale: state.locale,
        theme: state.theme,
        page: state.page,
        font: state.font,
        extensions: state.extensions,
        cover: state.cover,
        headerFooter: state.headerFooter,
        preview: state.preview,
        // customTemplates 刻意不进入 localStorage：它已经以 JSON 文件的形式
        // 存放在 userData/templates，由 loadCustomTemplates() 异步加载。
      }),
      // 默认合并是「持久化值覆盖初始值」的浅合并。
      // 旧版本曾把 markdown / currentTemplate / customTemplates 写进 localStorage，
      // 这里显式重置，保证即使本机残留历史数据也不会被恢复。
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<AppState>),
        markdown: '',
        currentTemplate: 'zhTech',
        customTemplates: currentState.customTemplates,
      }),
      // 在状态加载（rehydrate）时执行的验证逻辑
      onRehydrateStorage: (_state) => {
        return (rehydratedState, error) => {
          if (error) {
            logger.error('Failed to rehydrate app storage:', error);
          } else if (rehydratedState) {
            // 应用主题
            applyTheme(rehydratedState.theme || 'light');
            
            // 进行基本的设置验证，防止由于版本变更或手动篡改导致的非法值
            try {
              rehydratedState.page = validatePageSettings(rehydratedState.page);
              rehydratedState.font = validateFontSettings(rehydratedState.font);
              rehydratedState.extensions = validateExtensionSettings(rehydratedState.extensions);
              rehydratedState.cover = validateCoverSettings(rehydratedState.cover);
              rehydratedState.headerFooter = validateHeaderFooterSettings(rehydratedState.headerFooter);
              rehydratedState.preview = validatePreviewSettings(rehydratedState.preview);
            } catch (e) {
              logger.warn('Validation during rehydration failed, using some default values:', e);
            }
          }
        };
      },
    }
  )
);

// 启动时从磁盘（userData/templates）加载自定义模板。
// 加载是异步的，完成前列表为空；加载完成后 setState 触发一次更新即可。
void loadCustomTemplates().then((templates) => {
  if (templates.length > 0) {
    useAppStore.setState({ customTemplates: templates });
  }
});

// 界面语言变化时同步通知主进程，使原生菜单文案（文件/视图/帮助等）随之切换。
useAppStore.subscribe((state, prevState) => {
  if (state.locale !== prevState.locale) {
    window.electronAPI?.setLocale(state.locale);
  }
});

// 模块加载时主动同步一次，覆盖「persist 重水合早于订阅注册」导致首屏语言未同步菜单的情况。
if (typeof window !== 'undefined') {
  window.electronAPI?.setLocale(useAppStore.getState().locale);
}
