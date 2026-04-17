/**
 * MathJax 4 插件 for Markdown-it
 * 
 * 实现方式遵循 MathJax 官方最佳实践：
 * - 使用 ESM 导入方式
 * - 异步初始化后渲染
 * - 支持 typesetPromise 用于动态内容
 * - 支持行内公式 $...$ 和块级公式 $$...$$
 * 
 * @see https://docs.mathjax.org/en/latest/
 * @see https://github.com/mathjax/MathJax
 */

import MarkdownIt from 'markdown-it';
import MathJax from 'mathjax';
import { logger } from './logger';

// MathJax 初始化状态
let mathJaxInitialized = false;
let mathJaxInitializing = false;
let mathJaxInitPromise: Promise<void> | null = null;

// 公式标记类型
type MathType = 'inline' | 'display';

/**
 * 初始化 MathJax 4
 * 遵循官方推荐：等待 init 完成后再使用
 */
const initMathJax = async (): Promise<void> => {
  // 如果已经初始化，直接返回
  if (mathJaxInitialized) {
    return;
  }

  // 如果正在初始化，等待初始化完成
  if (mathJaxInitializing && mathJaxInitPromise) {
    return mathJaxInitPromise;
  }

  mathJaxInitializing = true;

  mathJaxInitPromise = MathJax.init({
    loader: {
      load: ['input/tex', 'output/svg'],
    },
    tex: {
      // 支持的行内公式分隔符
      inlineMath: [
        ['$', '$'],
        ['\\(', '\\)'],
      ],
      // 支持的块级公式分隔符
      displayMath: [
        ['$$', '$$'],
        ['\\[', '\\]'],
      ],
      // 启用常用 TeX 扩展包
      packages: {
        '[+]': ['ams', 'newcommand', 'configmacros', 'bbox', 'extpfeil'],
      },
    },
    svg: {
      // 全局字体缓存，减少重复加载
      fontCache: 'global',
      // 禁用字体本地化路径
      localFontPath: '',
      localFontFamily: '',
    },
  });

  try {
    await mathJaxInitPromise;
    mathJaxInitialized = true;
    logger.log('MathJax initialized successfully with SVG output');
  } catch (error) {
    mathJaxInitializing = false;
    mathJaxInitPromise = null;
    logger.error('Failed to initialize MathJax:', error);
    throw error;
  } finally {
    mathJaxInitializing = false;
  }
};

/**
 * 确保 MathJax 已初始化
 * 如果未初始化，则进行初始化
 */
const ensureMathJaxReady = async (): Promise<void> => {
  if (!mathJaxInitialized && !mathJaxInitializing) {
    await initMathJax();
  } else if (mathJaxInitializing) {
    await mathJaxInitPromise;
  }
};

/**
 * 异步渲染行内公式
 * @param math - LaTeX 数学表达式（不含分隔符）
 */
export const renderMathInlineAsync = async (math: string): Promise<string> => {
  try {
    await ensureMathJaxReady();
    const svg = await MathJax.tex2svgPromise(math, { display: false });
    return MathJax.startup.adaptor.outerHTML(svg);
  } catch (error) {
    logger.error('MathJax inline math render error:', error);
    return `\\(${math}\\)`;
  }
};

/**
 * 异步渲染块级公式
 * @param math - LaTeX 数学表达式（不含分隔符）
 */
export const renderMathDisplayAsync = async (math: string): Promise<string> => {
  try {
    await ensureMathJaxReady();
    const svg = await MathJax.tex2svgPromise(math, { display: true });
    return `<div class="math-display">${MathJax.startup.adaptor.outerHTML(svg)}</div>`;
  } catch (error) {
    logger.error('MathJax display math render error:', error);
    return `<div class="math-display">\\[${math}\\]</div>`;
  }
};

/**
 * 同步渲染行内公式（用于 Markdown-it 渲染规则）
 * 必须在 MathJax 初始化后才能调用
 * @param math - LaTeX 数学表达式（不含分隔符）
 */
const renderMathInlineSync = (math: string): string => {
  try {
    if (!mathJaxInitialized) {
      // MathJax 未初始化，返回占位符
      return `<span class="math-inline" data-math="${encodeURIComponent(math)}">\\(${math}\\)</span>`;
    }
    const svg = MathJax.tex2svg(math, { display: false });
    return MathJax.startup.adaptor.outerHTML(svg);
  } catch (error) {
    logger.error('MathJax inline math render error:', error);
    return `\\(${math}\\)`;
  }
};

/**
 * 同步渲染块级公式（用于 Markdown-it 渲染规则）
 * 必须在 MathJax 初始化后才能调用
 * @param math - LaTeX 数学表达式（不含分隔符）
 */
const renderMathDisplaySync = (math: string): string => {
  try {
    if (!mathJaxInitialized) {
      // MathJax 未初始化，返回占位符
      return `<div class="math-display" data-math="${encodeURIComponent(math)}">\\[${math}\\]</div>`;
    }
    const svg = MathJax.tex2svg(math, { display: true });
    return `<div class="math-display">${MathJax.startup.adaptor.outerHTML(svg)}</div>`;
  } catch (error) {
    logger.error('MathJax display math render error:', error);
    return `<div class="math-display">\\[${math}\\]</div>`;
  }
};

/**
 * 检测字符串是否为行内数学公式
 * 考虑了转义字符和边界情况
 */
const isInlineMath = (content: string): boolean => {
  // 必须以 $ 开头和结尾，中间不能有未转义的 $
  // 排除转义的 \$ 和 $$ (块级公式)
  if (!content.startsWith('$') || !content.endsWith('$')) {
    return false;
  }
  
  // 排除 $$ 开头的（块级公式）
  if (content.startsWith('$$')) {
    return false;
  }
  
  // 排除空字符串 $
  if (content.length < 3) {
    return false;
  }
  
  // 检查中间是否有 $ 但不是转义的 \$
  // 使用负向前瞻来排除 \$
  const inner = content.slice(1, -1);
  
  // 如果内部包含 $，可能是非数学用途（如 $100）
  // 但如果内部是纯数学表达式，应该只包含合法字符
  // 这里简单判断：如果内部包含未转义的 $ 且前后不是空白，则不是行内公式
  const hasUnescapedDollar = /(?<!\\)\$(?!\$)/.test(inner);
  
  // 更严格的检查：确保内部不是空的或只有空白
  const innerTrimmed = inner.trim();
  if (!innerTrimmed) {
    return false;
  }
  
  // 如果包含未转义的 $ 且不是简单数字/货币，可能是误判
  if (hasUnescapedDollar && !/^[\d\s,.\\()\[\]{}^_=+\-*/|<>:;"'&!~`]+$/.test(innerTrimmed)) {
    return false;
  }
  
  return true;
};

/**
 * 检测字符串是否为块级数学公式
 */
const isDisplayMath = (content: string): boolean => {
  // 必须以 $$ 开头和结尾
  if (!content.startsWith('$$') || !content.endsWith('$$')) {
    return false;
  }
  
  // 排除只有两个 $$ 的情况
  if (content.length < 4) {
    return false;
  }
  
  return true;
};

/**
 * Markdown-it MathJax 插件
 * 
 * 处理以下语法：
 * - 行内公式: $...$
 * - 块级公式: $$...$$
 * 
 * 架构说明：
 * 由于 Markdown-it 渲染规则是同步的，但 MathJax.init() 是异步的，
 * 所以采用以下策略：
 * 1. 如果 MathJax 已初始化，使用同步 tex2svg 直接渲染
 * 2. 如果 MathJax 未初始化，返回带有 data-math 属性的占位符
 * 3. 在 React 组件中，使用 typesetPromise 渲染占位符
 */
export const mathjaxPlugin = (md: MarkdownIt): void => {
  // 保存默认渲染规则
  const defaultRender = md.renderer.rules.code_inline;
  const defaultFenceRender = md.renderer.rules.fence;
  
  // 确保在首次渲染时启动 MathJax 初始化
  const ensureInit = () => {
    if (!mathJaxInitialized && !mathJaxInitializing) {
      // 异步启动，不阻塞渲染
      initMathJax().catch(() => {
        // 初始化失败已在 initMathJax 中记录
      });
    }
  };

  // 处理行内数学公式: $...$
  md.renderer.rules.code_inline = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const content = token.content;

    if (isInlineMath(content)) {
      // 确保 MathJax 在后台初始化
      ensureInit();
      
      // 提取公式内容（去除首尾 $）
      const math = content.slice(1, -1);
      // 总是返回占位符，由 typesetMath 函数在 DOM 渲染后处理
      return `<span class="math-inline" data-math="${encodeURIComponent(math)}">\(${math}\)</span>`;
    }

    // 非数学内容，使用默认渲染
    return defaultRender ? defaultRender(tokens, idx, options, env, self) : content;
  };

  // 处理块级数学公式: $$...$$
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const content = token.content;

    if (isDisplayMath(content)) {
      // 确保 MathJax 在后台初始化
      ensureInit();
      
      // 提取公式内容（去除首尾 $$）
      const math = content.slice(2, -2);
      // 总是返回占位符，由 typesetMath 函数在 DOM 渲染后处理
      return `<div class="math-display" data-math="${encodeURIComponent(math)}">\[${math}\]</div>`;
    }

    // 非数学内容，使用默认渲染
    return defaultFenceRender ? defaultFenceRender(tokens, idx, options, env, self) : content;
  };
};

/**
 * 渲染包含占位符的容器元素
 * 用于在 React 组件中渲染动态内容
 * 
 * @param container - DOM 容器元素
 * @returns Promise，渲染完成后 resolve
 */
export const typesetMath = async (container: HTMLElement): Promise<void> => {
  try {
    await ensureMathJaxReady();
    
    // 先清理已渲染的内容
    MathJax.startup.document.clear();
    
    // 渲染容器中的数学公式
    await MathJax.typesetPromise([container]);
  } catch (error) {
    logger.error('MathJax typeset error:', error);
    throw error;
  }
};

/**
 * 清理容器中的数学公式渲染
 * 用于在更新内容前重置 MathJax 状态
 * 
 * @param container - DOM 容器元素
 */
export const clearTypesetMath = (container: HTMLElement): void => {
  try {
    MathJax.typesetClear([container]);
  } catch (error) {
    // typesetClear 可能在新内容渲染前失败，忽略
    logger.warn('MathJax typesetClear warning:', error);
  }
};

/**
 * 重置 MathJax 状态
 * 用于处理复杂文档中的编号和引用
 */
export const resetMathJax = (): void => {
  try {
    if (mathJaxInitialized) {
      MathJax.startup.document.reset();
    }
  } catch (error) {
    logger.warn('MathJax reset warning:', error);
  }
};

/**
 * 获取 MathJax 初始化状态
 */
export const isMathJaxReady = (): boolean => {
  return mathJaxInitialized;
};

/**
 * 主动初始化 MathJax
 * 可在应用启动时调用，提前完成初始化
 */
export const initializeMathJax = async (): Promise<void> => {
  await initMathJax();
};

// 导出初始化函数供外部调用
export const initMathJaxInstance = initializeMathJax;
