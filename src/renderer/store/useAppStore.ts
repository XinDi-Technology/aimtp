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
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
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
  heading: string;
  code: string;
  baseSize: number;
  lineHeight: number;
  headingScale: number;
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

export interface AppState {
  markdown: string;
  setMarkdown: (markdown: string) => void;
  
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
  
  generatedHtml: string;
  setGeneratedHtml: (html: string) => void;
  
  showTemplateSelection: boolean;
  setShowTemplateSelection: (show: boolean) => void;
  
  customTemplates: CustomTemplate[];
  saveAsTemplate: (name: string) => void;
  applyTemplate: (templateId: string) => void;
  deleteTemplate: (templateId: string) => void;
  
  selectPresetTemplate: (templateKey: string) => void;

  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;
  lastSavedAt: number | null;
  setLastSavedAt: (time: number | null) => void;
  loadAutoSave: () => string | null;
  saveAutoSave: (content: string) => void;
}

export const TEMPLATES = {
  blank: `# 空白文档

在这里输入您的内容...

## 标题

正文内容...
`,

  report: `# 项目报告

## 概述

本文档概述了项目的关键信息和成果。

## 背景

描述项目的背景和目标。

## 主要成果

- 成果一：完成核心功能开发
- 成果二：优化用户体验
- 成果三：提升系统性能

## 数据分析

| 指标 | 数值 | 增长率 |
|------|------|--------|
| 用户数 | 1000 | 10% |
| 收入 | 50000 | 25% |

## 结论

项目已达到预期目标。

---

*报告人：*
*日期：2024年*
`,

  article: `# 文章标题

> 一句简短的副标题或引用

**作者名** | *2024年1月*

---

## 简介

在这里介绍文章的背景和主题。

## 主要内容

### 第一部分

详细说明...

### 第二部分

详细说明...

## 总结

总结文章的主要观点。

---

## 参考资料

1. 参考来源一
2. 参考来源二
`,

  documentation: `# API 文档

## 概述

本文档描述了系统 API 的使用方法。

## 认证

所有 API 请求需要携带 API Key：

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

## 接口列表

### 获取用户信息

\`\`\`
GET /api/users/:id
\`\`\`

**参数：**
- \`id\` (必需): 用户 ID

**响应：**
\`\`\`json
{
  "id": "1",
  "name": "张三",
  "email": "user@example.com"
}
\`\`\`

### 创建用户

\`\`\`
POST /api/users
\`\`\`

**请求体：**
\`\`\`json
{
  "name": "新用户",
  "email": "new@example.com"
}
\`\`\`

## 错误码

| 错误码 | 描述 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |
`,
};

const defaultPage: PageSettings = {
  size: 'A4',
  orientation: 'portrait',
  margins: {
    top: 10,
    bottom: 10,
    left: 10,
    right: 10,
  },
};

const defaultFont: FontSettings = {
  body: 'GWM Sans UI',
  heading: 'GWM Sans UI',
  code: 'JetBrains Mono',
  baseSize: 12,
  lineHeight: 1.6,
  headingScale: 1.2,
};

const defaultExtensions: ExtensionSettings = {
  githubAlerts: true,
  codeHighlight: true,
  codeTheme: 'github',
  showLineNumbers: false,
  taskLists: true,
  mermaid: false,
  mathJax: false,
  footnotes: true,
  mark: true,
  ins: true,
  sub: true,
  sup: true,
};

const defaultCover: CoverSettings = {
  enabled: false,
};

const defaultHeaderFooter: HeaderFooterSettings = {
  enabled: false,
  header: {
    font: 'GWM Sans UI',
    alignment: 'center',
    content: '',
  },
  footer: {
    font: 'GWM Sans UI',
    alignment: 'center',
    content: 'pageNumber',
  },
};

const defaultPreview: PreviewSettings = {
  targetDPI: 96, // 默认 96 DPI
};

const STORAGE_KEY = 'aimtp-custom-templates';
const AUTOSAVE_KEY = 'aimtp-autosave';
const AUTOSAVE_ENABLED_KEY = 'aimtp-autosave-enabled';

const isValidPageSize = (size: any): size is PageSettings['size'] => {
  return ['A4', 'A3'].includes(size);
};

const isValidOrientation = (orientation: any): orientation is PageSettings['orientation'] => {
  return ['portrait', 'landscape'].includes(orientation);
};

const isValidAlignment = (alignment: any): alignment is 'left' | 'center' | 'right' => {
  return ['left', 'center', 'right'].includes(alignment);
};

const isValidNumber = (value: any): value is number => {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
};

const isValidString = (value: any): value is string => {
  return typeof value === 'string';
};

const isValidBoolean = (value: any): value is boolean => {
  return typeof value === 'boolean';
};

const validatePageSettings = (data: any): PageSettings => {
  const defaults = { ...defaultPage };
  if (!data || typeof data !== 'object') return defaults;
  
  return {
    size: isValidPageSize(data.size) ? data.size : defaults.size,
    orientation: isValidOrientation(data.orientation) ? data.orientation : defaults.orientation,
    margins: {
      top: isValidNumber(data.margins?.top) ? data.margins.top : defaults.margins.top,
      bottom: isValidNumber(data.margins?.bottom) ? data.margins.bottom : defaults.margins.bottom,
      left: isValidNumber(data.margins?.left) ? data.margins.left : defaults.margins.left,
      right: isValidNumber(data.margins?.right) ? data.margins.right : defaults.margins.right,
    },
  };
};

const validateFontSettings = (data: any): FontSettings => {
  const defaults = { ...defaultFont };
  if (!data || typeof data !== 'object') return defaults;
  
  return {
    body: isValidString(data.body) ? data.body : defaults.body,
    heading: isValidString(data.heading) ? data.heading : defaults.heading,
    code: isValidString(data.code) ? data.code : defaults.code,
    baseSize: isValidNumber(data.baseSize) ? data.baseSize : defaults.baseSize,
    lineHeight: isValidNumber(data.lineHeight) ? data.lineHeight : defaults.lineHeight,
    headingScale: isValidNumber(data.headingScale) ? data.headingScale : defaults.headingScale,
  };
};

const validateExtensionSettings = (data: any): ExtensionSettings => {
  const defaults = { ...defaultExtensions };
  if (!data || typeof data !== 'object') return defaults;
  
  return {
    githubAlerts: isValidBoolean(data.githubAlerts) ? data.githubAlerts : defaults.githubAlerts,
    codeHighlight: isValidBoolean(data.codeHighlight) ? data.codeHighlight : defaults.codeHighlight,
    codeTheme: isValidString(data.codeTheme) ? data.codeTheme : defaults.codeTheme,
    showLineNumbers: isValidBoolean(data.showLineNumbers) ? data.showLineNumbers : defaults.showLineNumbers,
    taskLists: isValidBoolean(data.taskLists) ? data.taskLists : defaults.taskLists,
    mermaid: isValidBoolean(data.mermaid) ? data.mermaid : defaults.mermaid,
    // 兼容旧版本的 katex 设置
    mathJax: isValidBoolean(data.mathJax) ? data.mathJax : (isValidBoolean(data.katex) ? data.katex : defaults.mathJax),
    footnotes: isValidBoolean(data.footnotes) ? data.footnotes : defaults.footnotes,
    mark: isValidBoolean(data.mark) ? data.mark : defaults.mark,
    ins: isValidBoolean(data.ins) ? data.ins : defaults.ins,
    sub: isValidBoolean(data.sub) ? data.sub : defaults.sub,
    sup: isValidBoolean(data.sup) ? data.sup : defaults.sup,
  };
};

const validateCoverSettings = (data: any): CoverSettings => {
  const defaults = { ...defaultCover };
  if (!data || typeof data !== 'object') return defaults;
  
  return {
    enabled: isValidBoolean(data.enabled) ? data.enabled : defaults.enabled,
  };
};

const validateHeaderFooterSettings = (data: any): HeaderFooterSettings => {
  const defaults = { ...defaultHeaderFooter };
  if (!data || typeof data !== 'object') return defaults;
  
  return {
    enabled: isValidBoolean(data.enabled) ? data.enabled : defaults.enabled,
    header: {
      font: isValidString(data.header?.font) ? data.header.font : defaults.header.font,
      alignment: isValidAlignment(data.header?.alignment) ? data.header.alignment : defaults.header.alignment,
      content: isValidString(data.header?.content) ? data.header.content : defaults.header.content,
    },
    footer: {
      font: isValidString(data.footer?.font) ? data.footer.font : defaults.footer.font,
      alignment: isValidAlignment(data.footer?.alignment) ? data.footer.alignment : defaults.footer.alignment,
      content: isValidString(data.footer?.content) ? data.footer.content : defaults.footer.content,
    },
  };
};

const validatePreviewSettings = (data: any): PreviewSettings => {
  const defaults = { ...defaultPreview };
  if (!data || typeof data !== 'object') return defaults;
  
  let targetDPI = defaults.targetDPI;
  if (isValidNumber(data.targetDPI)) {
    targetDPI = Math.max(48, Math.min(480, data.targetDPI)); // 限制范围 48-480
  }
  
  return { targetDPI };
};

const validateTemplateSettings = (data: any): TemplateSettings => {
  if (!data || typeof data !== 'object') {
    return {
      page: defaultPage,
      font: defaultFont,
      extensions: defaultExtensions,
      headerFooter: defaultHeaderFooter,
      cover: defaultCover,
    };
  }
  
  return {
    page: validatePageSettings(data.page),
    font: validateFontSettings(data.font),
    extensions: validateExtensionSettings(data.extensions),
    headerFooter: validateHeaderFooterSettings(data.headerFooter),
    cover: validateCoverSettings(data.cover),
  };
};

const validateCustomTemplate = (data: any): CustomTemplate | null => {
  if (!data || typeof data !== 'object') return null;
  if (!isValidString(data.id) || !isValidString(data.name) || !isValidNumber(data.createdAt)) {
    return null;
  }
  
  return {
    id: data.id,
    name: data.name,
    settings: validateTemplateSettings(data.settings),
    createdAt: data.createdAt,
  };
};

const validateCustomTemplates = (data: any): CustomTemplate[] => {
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

const loadCustomTemplates = (): CustomTemplate[] => {
  if (!localStorageAvailable()) {
    logger.warn('localStorage is not available, using default templates');
    return [];
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const validated = validateCustomTemplates(parsed);
      if (validated.length !== parsed.length) {
        logger.warn('Some templates were invalid and discarded during loading');
      }
      return validated;
    }
  } catch (error) {
    logger.error('Failed to load custom templates:', error);
  }
  return [];
};

const saveCustomTemplates = (templates: CustomTemplate[]) => {
  if (!localStorageAvailable()) {
    logger.warn('localStorage is not available, cannot save templates');
    return;
  }
  try {
    // TODO: [潜在问题8] localStorage 容量无限制处理
    // 如果用户保存大量模板，可能导致存储失败
    // 建议：检测容量超限并提示用户清理旧数据
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    logger.error('Failed to save custom templates:', error);
  }
};

const loadAutoSaveEnabled = (): boolean => {
  if (!localStorageAvailable()) {
    logger.warn('localStorage is not available, using default autosave setting');
    return true;
  }
  try {
    const stored = localStorage.getItem(AUTOSAVE_ENABLED_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return isValidBoolean(parsed) ? parsed : true;
    }
  } catch (error) {
    logger.error('Failed to load autosave setting:', error);
  }
  return true;
};

const saveAutoSaveEnabled = (enabled: boolean) => {
  if (!localStorageAvailable()) {
    logger.warn('localStorage is not available, cannot save autosave setting');
    return;
  }
  try {
    localStorage.setItem(AUTOSAVE_ENABLED_KEY, JSON.stringify(enabled));
  } catch (error) {
    logger.error('Failed to save autosave setting:', error);
  }
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      markdown: TEMPLATES.blank,
      setMarkdown: (markdown) => set({ markdown }),
      
      currentTemplate: 'blank',
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
      
      generatedHtml: '',
      setGeneratedHtml: (generatedHtml) => set({ generatedHtml }),
      
      showTemplateSelection: false,
      setShowTemplateSelection: (show) => set({ showTemplateSelection: show }),
      
      customTemplates: loadCustomTemplates(),
      
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
        saveCustomTemplates(newTemplates);
        set({
          customTemplates: newTemplates,
        });
      },
      
      applyTemplate: (templateId) => {
        const state = get();
        const template = state.customTemplates.find(t => t.id === templateId);
        if (template) {
          set({
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
        saveCustomTemplates(newTemplates);
        set({
          customTemplates: newTemplates,
        });
      },
      
      selectPresetTemplate: (templateKey) => {
        const template = TEMPLATES[templateKey as keyof typeof TEMPLATES];
        if (template) {
          set({
            markdown: template,
            currentTemplate: templateKey,
            showTemplateSelection: false, // 关闭模板选择面板
          });
        }
      },

      autoSaveEnabled: loadAutoSaveEnabled(),
      setAutoSaveEnabled: (enabled) => {
        saveAutoSaveEnabled(enabled);
        set({ autoSaveEnabled: enabled });
      },

      lastSavedAt: null,
      setLastSavedAt: (time) => set({ lastSavedAt: time }),

      loadAutoSave: () => {
        if (!localStorageAvailable()) {
          logger.warn('localStorage is not available, cannot load autosave');
          return null;
        }
        try {
          const stored = localStorage.getItem(AUTOSAVE_KEY);
          if (stored) {
            const data = JSON.parse(stored);
            if (isValidString(data.content) && isValidNumber(data.timestamp)) {
              return data.content;
            }
          }
        } catch (error) {
          logger.error('Failed to load autosave:', error);
        }
        return null;
      },

      saveAutoSave: (content) => {
        if (!localStorageAvailable()) {
          logger.warn('localStorage is not available, cannot save autosave');
          return;
        }
        try {
          // TODO: [潜在问题8] localStorage 容量无限制处理
          // 如果文档很大，可能导致存储失败
          // 建议：检测容量超限并提示用户，或改用 IndexedDB
          localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
            content,
            timestamp: Date.now(),
          }));
          set({ lastSavedAt: Date.now() });
        } catch (error) {
          logger.error('Failed to save autosave:', error);
        }
      },
    }),
    {
      name: 'aimtp-app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        markdown: state.markdown,
        locale: state.locale,
        theme: state.theme,
        page: state.page,
        font: state.font,
        extensions: state.extensions,
        cover: state.cover,
        headerFooter: state.headerFooter,
        preview: state.preview,
        autoSaveEnabled: state.autoSaveEnabled,
        customTemplates: state.customTemplates,
        currentTemplate: state.currentTemplate,
      }),
      // 在状态加载（rehydrate）时执行的验证逻辑
      onRehydrateStorage: (state) => {
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
              rehydratedState.customTemplates = validateCustomTemplates(rehydratedState.customTemplates);
            } catch (e) {
              logger.warn('Validation during rehydration failed, using some default values:', e);
            }
          }
        };
      },
    }
  )
);
