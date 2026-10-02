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

/** 导出进度 — 与 ExportTypes.ts 对齐 */
export interface ExportProgressState {
  stage: 'validate' | 'prepare' | 'pdfGenerate' | 'postProcess' | 'save';
  percentage: number;
  message: string;
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

  // ─── 迭代3 新增状态 ───

  /** Layout DOM 引用（含 Document，不可序列化，不持久化） */
  layoutDOM: unknown | null;
  setLayoutDOM: (dom: unknown | null) => void;

  /** 导出进度 */
  exportProgress: ExportProgressState | null;
  setExportProgress: (progress: ExportProgressState | null) => void;

  /** 上次导出路径 */
  lastExportPath: string | null;
  setLastExportPath: (path: string | null) => void;

  /** 最新一次设置变更分类 */
  settingChangeCategory: SettingChangeCategory;
  setSettingChangeCategory: (category: SettingChangeCategory) => void;
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
  code: 'JetBrains Mono',
  baseSize: 12,
  lineHeight: 1.6,
  paragraphSpacing: 0,
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
  footnoteMode: 'end',
  h1PageBreak: false,
  h2PageBreak: false,
  mark: true,
  ins: true,
  sub: true,
  sup: true,
};

const defaultCover: CoverSettings = {
  enabled: false,
};

const defaultHeaderFooter: HeaderFooterSettings = {
  enabled: true, // 🔧 修复：默认启用页眉页脚
  header: {
    font: 'GWM Sans UI',
    alignment: 'center',
    content: '', // 页眉默认不显示内容（用户可选配置）
  },
  footer: {
    font: 'GWM Sans UI',
    alignment: 'center',
    content: 'pageNumber', // 页脚默认显示页码
  },
};

const defaultPreview: PreviewSettings = {
  targetDPI: 96, // 默认 96 DPI
};

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

      // ─── 迭代3 新增状态 ───

      layoutDOM: null,
      setLayoutDOM: (dom) => set({ layoutDOM: dom }),

      exportProgress: null,
      setExportProgress: (progress) => set({ exportProgress: progress }),

      lastExportPath: null,
      setLastExportPath: (path) => set({ lastExportPath: path }),

      settingChangeCategory: 'content-change',
      setSettingChangeCategory: (category) => set({ settingChangeCategory: category }),
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
        customTemplates: state.customTemplates,
        currentTemplate: state.currentTemplate,
        lastExportPath: state.lastExportPath,
        // 注意：layoutDOM、exportProgress、settingChangeCategory 不持久化
        // layoutDOM 含 Document 引用不可序列化
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
