/**
 * Mermaid 流程图插件 - 按照 Mermaid 11 官方最佳实践实现
 * 
 * 使用方式：
 * 1. 在 markdown.ts 中使用此插件
 * 2. 在渲染后调用 renderMermaid(container) 渲染图表
 * 
 * 官方文档：https://mermaid.js.org/
 */

import MarkdownIt from 'markdown-it';
import mermaid from 'mermaid';
import { logger } from './logger';

// ============================================================================
// 初始化状态管理
// ============================================================================

/** Mermaid 是否已初始化 */
let mermaidInitialized = false;

/** 唯一 ID 计数器，用于生成不重复的图表 ID */
let mermaidIdCounter = 0;

/**
 * 生成唯一的 Mermaid 图表 ID
 */
const generateMermaidId = (): string => {
  return `mermaid-${++mermaidIdCounter}-${Date.now()}`;
};

// ============================================================================
// Mermaid 配置
// ============================================================================

/**
 * Mermaid 配置接口
 */
export interface MermaidConfig {
  theme?: 'default' | 'dark' | 'forest' | 'neutral' | 'base';
  themeVariables?: Record<string, string>;
  securityLevel?: 'strict' | 'antiscript' | 'loose' | 'sandbox';
  startOnLoad?: boolean;
  maxTextSize?: number;
  fontFamily?: string;
  flowchart?: {
    curve?: 'basis' | 'linear' | 'cardinal' | 'monotoneY';
    htmlLabels?: boolean;
    useMaxWidth?: boolean;
    padding?: number;
  };
  sequence?: {
    showSequenceNumbers?: boolean;
    diagramMarginX?: number;
    diagramMarginY?: number;
    actorMargin?: number;
    width?: number;
    height?: number;
    boxMargin?: number;
    boxTextMargin?: number;
    noteMargin?: number;
    messageMargin?: number;
    mirrorActors?: boolean;
    bottomMarginAdj?: number;
    rightAngles?: boolean;
    showManyErrors?: boolean;
  };
}

/**
 * 默认 Mermaid 配置 - 适合本地桌面应用
 */
const defaultMermaidConfig: MermaidConfig = {
  startOnLoad: false,  // 禁用自动渲染，手动控制
  theme: 'default',
  securityLevel: 'loose',  // 本地应用允许较宽松的安全级别
  maxTextSize: 50000,
  fontFamily: 'Arial, sans-serif',
  flowchart: {
    curve: 'basis',
    htmlLabels: true,
    useMaxWidth: true,
    padding: 15,
  },
  sequence: {
    showSequenceNumbers: true,
    diagramMarginX: 20,
    diagramMarginY: 20,
    actorMargin: 50,
    width: 150,
    height: 65,
    boxMargin: 10,
    boxTextMargin: 5,
    noteMargin: 10,
    messageMargin: 35,
  },
};

/**
 * 更新 Mermaid 配置
 * @param config 部分配置，将与默认配置合并
 */
export const updateMermaidConfig = (config: Partial<MermaidConfig>): void => {
  if (mermaidInitialized) {
    // Mermaid 不支持动态更新配置，需要重新初始化
    // 这里我们合并配置但不实际调用 initialize
    Object.assign(defaultMermaidConfig, config);
    logger.warn('Mermaid: 配置已更新，但需要重新初始化才能生效');
  }
};

// ============================================================================
// Mermaid 初始化
// ============================================================================

/**
 * 初始化 Mermaid（幂等操作，多次调用只会初始化一次）
 * @param config 可选的配置覆盖
 */
export const initializeMermaid = (config?: Partial<MermaidConfig>): void => {
  if (mermaidInitialized) {
    return;
  }

  try {
    // 合并配置
    const finalConfig = { ...defaultMermaidConfig, ...config };

    // 初始化 Mermaid
    mermaid.initialize(finalConfig as any);
    
    mermaidInitialized = true;
    logger.log('Mermaid initialized successfully with config:', finalConfig);
  } catch (error) {
    logger.error('Failed to initialize Mermaid:', error);
    throw error;
  }
};

/**
 * 异步初始化 Mermaid（返回 Promise）
 */
export const initializeMermaidAsync = async (config?: Partial<MermaidConfig>): Promise<void> => {
  initializeMermaid(config);
};

/**
 * 重置 Mermaid 状态（用于测试或重新初始化）
 */
export const resetMermaid = (): void => {
  mermaidInitialized = false;
  mermaidIdCounter = 0;
};

// ============================================================================
// Mermaid 渲染
// ============================================================================

/**
 * 渲染 Mermaid 图表的核心方法
 * 使用 mermaid.run() 官方推荐的渲染方式
 * 
 * @param container 包含 .mermaid 元素的 DOM 容器
 * @param options 渲染选项
 */
export const renderMermaid = async (
  container: HTMLElement,
  options: {
    suppressErrors?: boolean;
    resetMmdId?: boolean;
  } = {}
): Promise<void> => {
  // 确保 Mermaid 已初始化
  if (!mermaidInitialized) {
    initializeMermaid();
  }

  const { suppressErrors = true, resetMmdId = false } = options;

  try {
    // 查找所有 .mermaid 元素
    const mermaidElements = container.querySelectorAll('.mermaid');
    
    if (mermaidElements.length === 0) {
      return;
    }

    // 如果需要重置 ID，为每个元素生成新的 ID
    if (resetMmdId) {
      mermaidElements.forEach((el) => {
        const newId = generateMermaidId();
        el.setAttribute('id', newId);
      });
    }

    // 使用 mermaid.run() 渲染
    await mermaid.run({
      nodes: Array.from(mermaidElements) as HTMLElement[],
      suppressErrors,
    });

    logger.log(`Mermaid: Successfully rendered ${mermaidElements.length} diagram(s)`);
  } catch (error) {
    logger.error('Mermaid rendering error:', error);
    throw error;
  }
};

/**
 * 同步渲染单个 Mermaid 图表
 * 使用 mermaid.render() 方法（返回 SVG 字符串）
 * 
 * @param code Mermaid 图表定义代码
 * @param id 可选的图表 ID，不提供则自动生成
 * @returns SVG 字符串
 */
export const renderMermaidSync = async (
  code: string,
  id?: string
): Promise<string> => {
  // 确保 Mermaid 已初始化
  if (!mermaidInitialized) {
    initializeMermaid();
  }

  const chartId = id || generateMermaidId();

  try {
    // 使用异步的 mermaid.render() 方法
    const { svg, bindFunctions } = await mermaid.render(chartId, code);
    
    logger.log(`Mermaid: Successfully rendered diagram ${chartId}`);
    
    return svg;
  } catch (error) {
    logger.error(`Mermaid rendering error for diagram ${chartId}:`, error);
    throw error;
  }
};

// ============================================================================
// Markdown-it 插件
// ============================================================================

/**
 * Mermaid Markdown-it 插件
 * 
 * 此插件将 ```mermaid 代码块转换为带有 class="mermaid" 的 <pre> 标签
 * 实际的 SVG 渲染由 renderMermaid() 函数在 DOM 渲染后执行
 * 
 * 使用方式：
 * ```typescript
 * md.use(mermaidPlugin);
 * 
 * // 在 DOM 渲染后
 * renderMermaid(container);
 * ```
 */
export const mermaidPlugin = (md: MarkdownIt): void => {
  // 初始化 Mermaid（幂等操作）
  initializeMermaid();

  // 保存默认的 fence 渲染规则
  const defaultFenceRender = md.renderer.rules.fence;

  // 重写 fence 规则
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const info = token.info.trim().toLowerCase();
    const content = token.content.trim();

    // 检查是否是 Mermaid 代码块
    if (info === 'mermaid') {
      // 生成唯一 ID
      const chartId = generateMermaidId();

      // 返回带有 class="mermaid" 的 pre 标签
      // Mermaid 会自动查找并渲染这些标签
      return `<pre class="mermaid" id="${chartId}">${escapeHtml(content)}</pre>`;
    }

    // 对于其他代码块，使用默认渲染
    return defaultFenceRender
      ? defaultFenceRender(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
  };
};

/**
 * HTML 转义（防止 XSS）
 */
const escapeHtml = (text: string): string => {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
};

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建 Mermaid 图表容器（用于程序化创建图表）
 * 
 * @param code Mermaid 图表定义
 * @param id 可选的图表 ID
 * @returns HTML 字符串
 */
export const createMermaidContainer = (code: string, id?: string): string => {
  const chartId = id || generateMermaidId();
  return `<pre class="mermaid" id="${chartId}">${escapeHtml(code)}</pre>`;
};

/**
 * 初始化 Mermaid 实例（兼容旧 API）
 * @deprecated 请使用 initializeMermaid()
 */
export const initMermaidInstance = initializeMermaid;
