import { logger } from './logger';

let mathJaxInitialized = false;
let mathJaxInitializing = false;
let mathJaxInitPromise: Promise<void> | null = null;
let mathJaxLoadFailed = false;

const MATHJAX_SCRIPT_TIMEOUT = 15000;

/**
 * 动态按需加载 MathJax v4 tex-mml-svg-mathjax-newcm.js 脚本。
 *
 * 使用 mathjax-newcm-font 完整打包版本（~1.76MB），内嵌所有 SVG 字体路径数据，
 * 无需动态加载外部字体文件，适合 Electron/ASAR/file:// 离线环境。
 */
const loadMathJaxScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-mathjax-tex-svg]');
    if (existing) {
      console.warn('[MathJax] Script tag already exists, skipping load');
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = './vendor/tex-mml-svg-mathjax-newcm.js';
    script.setAttribute('data-mathjax-tex-svg', 'true');
    console.warn('[MathJax] Loading script from:', script.src);

    const timeout = setTimeout(() => {
      cleanup();
      console.error('[MathJax] Script load TIMEOUT after', MATHJAX_SCRIPT_TIMEOUT, 'ms');
      reject(new Error('MathJax script load timeout'));
    }, MATHJAX_SCRIPT_TIMEOUT);

    const cleanup = () => {
      clearTimeout(timeout);
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };

    const onLoad = () => {
      cleanup();
      console.warn('[MathJax] Script load event fired');
      resolve();
    };

    const onError = (e: Event) => {
      cleanup();
      console.error('[MathJax] Script load ERROR:', e);
      reject(new Error('MathJax script failed to load'));
    };

    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    document.head.appendChild(script);
  });
};

/**
 * 等待 MathJax v4 初始化完成。
 */
const waitForMathJaxReady = async (): Promise<void> => {
  const mj = (window as any).MathJax;

  if (!mj) {
    throw new Error('MathJax global object not found after script load');
  }

  if (mj.startup && typeof mj.startup.promise?.then === 'function') {
    console.warn('[MathJax] Waiting for startup.promise...');
    await mj.startup.promise;
    console.warn('[MathJax] startup.promise resolved');
  } else {
    console.warn('[MathJax] No startup.promise, polling for API...');
    const startTime = Date.now();
    while (typeof mj.tex2svg !== 'function') {
      if (Date.now() - startTime > 10000) {
        throw new Error('MathJax init timeout: tex2svg not available');
      }
      await new Promise(r => setTimeout(r, 100));
    }
  }

  const hasSync = typeof mj.tex2svg === 'function';
  const hasPromise = typeof mj.tex2svgPromise === 'function';
  const hasAdaptor = !!(mj.startup?.adaptor?.outerHTML);
  console.warn('[MathJax] Ready. tex2svg:', hasSync, 'tex2svgPromise:', hasPromise, 'adaptor:', hasAdaptor);

  if (!hasSync && !hasPromise) {
    throw new Error('MathJax initialized but no rendering API available');
  }
};

const initMathJax = async (): Promise<void> => {
  if (mathJaxInitialized) return;
  if (mathJaxLoadFailed) {
    throw new Error('MathJax previously failed to load — not retrying');
  }
  if (mathJaxInitializing && mathJaxInitPromise) return mathJaxInitPromise;

  mathJaxInitializing = true;
  console.warn('[MathJax] Starting initialization...');

  mathJaxInitPromise = (async () => {
    try {
      await loadMathJaxScript();
      await waitForMathJaxReady();
      mathJaxInitialized = true;
      console.warn('[MathJax] Initialized successfully');
    } catch (error) {
      mathJaxInitialized = false;
      mathJaxLoadFailed = true;
      mathJaxInitPromise = null;
      console.error('[MathJax] Init FAILED:', error);
      throw error;
    } finally {
      mathJaxInitializing = false;
    }
  })();

  await mathJaxInitPromise;
};

const ensureMathJaxReady = async (): Promise<void> => {
  if (!mathJaxInitialized && !mathJaxInitializing) {
    await initMathJax();
  } else if (mathJaxInitializing) {
    await mathJaxInitPromise;
  }
};

/**
 * 将 MathJax 输出节点序列化为 HTML 字符串
 */
const serializeNode = (node: any, mj: any): string => {
  if (!node) {
    console.error('[MathJax] serializeNode: node is null/undefined');
    return '';
  }

  // 优先使用 startup.adaptor（官方推荐序列化方式）
  if (mj.startup?.adaptor?.outerHTML) {
    try {
      const html = mj.startup.adaptor.outerHTML(node);
      if (html && html.length > 0) {
        return html;
      }
      console.warn('[MathJax] adaptor.outerHTML returned empty');
    } catch (e) {
      console.error('[MathJax] adaptor.outerHTML threw:', e);
    }
  }

  // 回退：浏览器原生序列化
  try {
    if (typeof node.outerHTML === 'string') {
      return node.outerHTML;
    }
  } catch (e) {
    // ignore
  }

  try {
    return String(node);
  } catch (e) {
    console.error('[MathJax] All serialization methods failed');
    return '';
  }
};

/**
 * 使用 MathJax v4 渲染数学公式。
 *
 * 使用 tex-mml-svg-mathjax-newcm.js 完整打包版，内嵌字体数据，
 * tex2svgPromise 不会因动态字体加载而挂起。
 *
 * 渲染策略：
 * 1. tex2svgPromise — v4 推荐异步 API（内嵌字体后可靠运行）
 * 2. tex2svg 同步回退 — 在异步 API 异常时使用
 */
const renderMath = async (math: string, display: boolean): Promise<string> => {
  await ensureMathJaxReady();

  const mj = (window as any).MathJax;
  console.warn('[MathJax] renderMath called, display:', display, 'math length:', math.length);

  // 方法 1: tex2svgPromise（v4 推荐，内嵌字体后不会挂起）
  if (typeof mj.tex2svgPromise === 'function') {
    try {
      console.warn('[MathJax] Calling tex2svgPromise...');
      const node = await mj.tex2svgPromise(math, { display });
      const html = serializeNode(node, mj);
      if (html) {
        console.warn('[MathJax] tex2svgPromise succeeded, HTML length:', html.length);
        return html;
      }
      console.warn('[MathJax] tex2svgPromise returned empty result');
    } catch (error) {
      console.error('[MathJax] tex2svgPromise failed:', error);
    }
  }

  // 方法 2: tex2svg 同步回退
  if (typeof mj.tex2svg === 'function') {
    try {
      console.warn('[MathJax] Trying tex2svg (sync)...');
      let node: any;
      if (typeof mj.handleRetriesFor === 'function') {
        node = await mj.handleRetriesFor(() => mj.tex2svg(math, { display }));
      } else {
        node = mj.tex2svg(math, { display });
      }
      const html = serializeNode(node, mj);
      if (html) {
        console.warn('[MathJax] tex2svg succeeded, HTML length:', html.length);
        return html;
      }
      console.warn('[MathJax] tex2svg returned empty result');
    } catch (error) {
      console.error('[MathJax] tex2svg failed:', error);
    }
  }

  throw new Error('All MathJax rendering methods failed');
};

export const renderMathInlineAsync = async (math: string): Promise<string> => {
  try {
    return await renderMath(math, false);
  } catch (error) {
    console.error('[MathJax] Inline render error:', error);
    return `\\(${math}\\)`;
  }
};

export const renderMathDisplayAsync = async (math: string): Promise<string> => {
  try {
    const html = await renderMath(math, true);
    return `<div class="math-display">${html}</div>`;
  } catch (error) {
    console.error('[MathJax] Display render error:', error);
    return `<div class="math-display">\\[${math}\\]</div>`;
  }
};

export const isMathJaxReady = (): boolean => {
  return mathJaxInitialized;
};

export const initializeMathJax = async (): Promise<void> => {
  await initMathJax();
};
