import { logger } from './logger';

let mathJaxInitialized = false;
let mathJaxInitializing = false;
let mathJaxInitPromise: Promise<void> | null = null;
let mathJaxLoadFailed = false;

const MATHJAX_SCRIPT_TIMEOUT = 15000;
const MATHJAX_RENDER_TIMEOUT = 30000;

/**
 * 动态按需加载 MathJax v4 tex-svg.js 脚本。
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
    script.src = './vendor/tex-svg.js';
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

  // 使用 startup.promise 等待就绪
  if (mj.startup && typeof mj.startup.promise?.then === 'function') {
    console.warn('[MathJax] Waiting for startup.promise...');
    await mj.startup.promise;
    console.warn('[MathJax] startup.promise resolved');
  } else {
    // 回退：轮询
    console.warn('[MathJax] No startup.promise, polling for API...');
    const startTime = Date.now();
    while (typeof mj.tex2svgPromise !== 'function' && typeof mj.tex2svg !== 'function') {
      if (Date.now() - startTime > 10000) {
        throw new Error('MathJax init timeout: no rendering API available');
      }
      await new Promise(r => setTimeout(r, 100));
    }
  }

  const hasPromise = typeof mj.tex2svgPromise === 'function';
  const hasSync = typeof mj.tex2svg === 'function';
  console.warn('[MathJax] Ready. tex2svgPromise:', hasPromise, 'tex2svg:', hasSync, 'adaptor:', !!mj.startup?.adaptor);

  if (!hasPromise && !hasSync) {
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
 * 带超时的 Promise 包装
 */
const withTimeout = <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
};

/**
 * 将 MathJax 输出节点序列化为 HTML 字符串
 */
const serializeNode = (node: any, mj: any): string => {
  if (!node) {
    console.error('[MathJax] serializeNode: node is null/undefined');
    return '';
  }

  // 优先使用 startup.adaptor（官方推荐）
  if (mj.startup?.adaptor?.outerHTML) {
    try {
      const html = mj.startup.adaptor.outerHTML(node);
      if (html && html.length > 0) {
        return html;
      }
      console.warn('[MathJax] adaptor.outerHTML returned empty, falling back');
    } catch (e) {
      console.error('[MathJax] adaptor.outerHTML threw:', e);
    }
  }

  // 回退：浏览器原生序列化
  try {
    if (typeof node.outerHTML === 'string') {
      return node.outerHTML;
    }
    if (typeof node.innerHTML === 'string' && node.tagName) {
      return node.outerHTML;
    }
  } catch (e) {
    console.error('[MathJax] native serialization failed:', e);
  }

  // 最终回退
  try {
    return String(node);
  } catch (e) {
    console.error('[MathJax] String() failed:', e);
    return '';
  }
};

/**
 * 使用 MathJax v4 渲染数学公式。
 * 优先使用 tex2svgPromise（v4 推荐异步 API），回退到 tex2svg（同步 API）。
 */
const renderMath = async (math: string, display: boolean): Promise<string> => {
  await ensureMathJaxReady();

  const mj = (window as any).MathJax;
  console.warn('[MathJax] renderMath called, display:', display, 'math length:', math.length);

  // 方法 1: tex2svgPromise（v4 推荐异步 API）
  if (typeof mj.tex2svgPromise === 'function') {
    try {
      console.warn('[MathJax] Calling tex2svgPromise...');
      const node = await withTimeout(
        mj.tex2svgPromise(math, { display }),
        MATHJAX_RENDER_TIMEOUT,
        'tex2svgPromise timeout after ' + MATHJAX_RENDER_TIMEOUT + 'ms',
      );
      console.warn('[MathJax] tex2svgPromise returned, serializing...');

      const html = serializeNode(node, mj);
      if (html) {
        console.warn('[MathJax] Serialized HTML length:', html.length);
        return html;
      }
      console.warn('[MathJax] tex2svgPromise returned empty result, trying fallback');
    } catch (error) {
      console.error('[MathJax] tex2svgPromise failed:', error);
      // 不要直接 throw，尝试 fallback
    }
  }

  // 方法 2: tex2svg（同步 API，可能触发 "MathJax retry" 错误）
  if (typeof mj.tex2svg === 'function') {
    try {
      console.warn('[MathJax] Falling back to tex2svg (sync)...');
      const node = mj.tex2svg(math, { display });
      const html = serializeNode(node, mj);
      if (html) {
        console.warn('[MathJax] tex2svg succeeded, HTML length:', html.length);
        return html;
      }
    } catch (error) {
      console.error('[MathJax] tex2svg failed:', error);
    }
  }

  // 方法 3: typesetPromise（DOM 排版方式）
  if (typeof mj.typesetPromise === 'function') {
    try {
      console.warn('[MathJax] Falling back to typesetPromise (DOM)...');
      const container = document.createElement('div');
      container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none';
      container.textContent = display ? `$$${math}$$` : `\\(${math}\\)`;
      document.body.appendChild(container);

      await withTimeout(
        mj.typesetPromise([container]),
        MATHJAX_RENDER_TIMEOUT,
        'typesetPromise timeout after ' + MATHJAX_RENDER_TIMEOUT + 'ms',
      );

      const html = container.innerHTML;
      console.warn('[MathJax] typesetPromise succeeded, HTML length:', html.length);
      return html;
    } catch (error) {
      console.error('[MathJax] typesetPromise failed:', error);
    } finally {
      // 清理临时容器
      const tmp = document.querySelector('div[style*="-9999px"]');
      if (tmp) tmp.remove();
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
