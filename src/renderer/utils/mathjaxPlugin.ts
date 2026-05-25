import { logger } from './logger';

let mathJaxInitialized = false;
let mathJaxInitializing = false;
let mathJaxInitPromise: Promise<void> | null = null;
let mathJaxLoadFailed = false;

const MATHJAX_SCRIPT_TIMEOUT = 15000;

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
 * 使用 MathJax.startup.promise（官方推荐方式）等待 MathJax 完全就绪。
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
    // 回退：轮询等待 tex2svgPromise 可用
    console.warn('[MathJax] No startup.promise, polling for tex2svgPromise...');
    const startTime = Date.now();
    while (typeof mj.tex2svgPromise !== 'function') {
      if (Date.now() - startTime > 10000) {
        throw new Error('MathJax init timeout: tex2svgPromise not available');
      }
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // 验证关键 API
  if (typeof mj.tex2svgPromise !== 'function') {
    console.error('[MathJax] tex2svgPromise not available after init. Available keys:', Object.keys(mj).join(','));
    throw new Error('MathJax initialized but tex2svgPromise not available');
  }

  console.warn('[MathJax] Ready. tex2svgPromise:', typeof mj.tex2svgPromise, 'adaptor:', !!mj.startup?.adaptor);
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
 * 使用 MathJax v4 的 tex2svgPromise 渲染数学公式。
 * 这是 MathJax v4 官方推荐的异步 API，能正确处理动态字体加载。
 *
 * 返回值通过 startup.adaptor.outerHTML() 序列化为 HTML 字符串。
 */
const renderMath = async (math: string, display: boolean): Promise<string> => {
  await ensureMathJaxReady();

  const mj = (window as any).MathJax;

  try {
    const node = await mj.tex2svgPromise(math, { display });

    // 使用 startup.adaptor 序列化（官方推荐方式）
    if (mj.startup?.adaptor?.outerHTML) {
      return mj.startup.adaptor.outerHTML(node);
    }

    // 回退：浏览器原生序列化
    if (node && typeof node.outerHTML === 'string') {
      return node.outerHTML;
    }

    throw new Error('Cannot serialize MathJax output');
  } catch (error) {
    console.error('[MathJax] tex2svgPromise render failed:', error);
    throw error;
  }
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
