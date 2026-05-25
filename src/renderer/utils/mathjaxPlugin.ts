import { logger } from './logger';

let MathJax: any = null;

let mathJaxInitialized = false;
let mathJaxInitializing = false;
let mathJaxInitPromise: Promise<void> | null = null;
let mathJaxLoadFailed = false;

const MATHJAX_SCRIPT_TIMEOUT = 15000;
const MATHJAX_INIT_POLL_INTERVAL = 50;
const MATHJAX_INIT_TIMEOUT = 10000;

/**
 * 动态按需加载 MathJax v4 tex-svg.js 脚本。
 */
const loadMathJaxScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[data-mathjax-tex-svg]')) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = './vendor/tex-svg.js';
    script.setAttribute('data-mathjax-tex-svg', 'true');

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('MathJax script load timeout'));
    }, MATHJAX_SCRIPT_TIMEOUT);

    const cleanup = () => {
      clearTimeout(timeout);
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };

    const onLoad = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error('MathJax script failed to load'));
    };

    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    document.head.appendChild(script);
  });
};

/**
 * 等待 MathJax v4 内部初始化完成。
 * tex-svg.js 加载后，MathJax 会异步初始化组件，需要轮询等待 typesetPromise 可用。
 */
const waitForMathJaxReady = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      const mj = (window as any).MathJax;
      if (mj && typeof mj.typesetPromise === 'function') {
        logger.log('MathJax v4 ready (typesetPromise available)');
        resolve();
        return;
      }

      if (Date.now() - startTime > MATHJAX_INIT_TIMEOUT) {
        reject(new Error('MathJax v4 initialization timeout'));
        return;
      }

      setTimeout(check, MATHJAX_INIT_POLL_INTERVAL);
    };

    check();
  });
};

const initMathJax = async (): Promise<void> => {
  if (mathJaxInitialized) return;
  if (mathJaxLoadFailed) {
    throw new Error('MathJax previously failed to load — not retrying');
  }
  if (mathJaxInitializing && mathJaxInitPromise) return mathJaxInitPromise;

  mathJaxInitializing = true;
  mathJaxInitPromise = (async () => {
    try {
      await loadMathJaxScript();
      await waitForMathJaxReady();

      const mj = (window as any).MathJax;
      if (!mj || typeof mj.typesetPromise !== 'function') {
        throw new Error('MathJax v4 initialized but typesetPromise not available');
      }

      MathJax = mj;
      mathJaxInitialized = true;
      logger.log('MathJax v4 initialized successfully');
    } catch (error) {
      mathJaxInitialized = false;
      mathJaxLoadFailed = true;
      mathJaxInitPromise = null;
      logger.error('Failed to initialize MathJax v4:', error);
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
 * 使用 MathJax v4 的 tex2svg API 渲染数学公式。
 */
const renderMath = (math: string, display: boolean): string => {
  const mj = MathJax;
  const svg = mj.tex2svg(math, { display });
  return mj.startup.adaptor.outerHTML(svg);
};

export const renderMathInlineAsync = async (math: string): Promise<string> => {
  try {
    await ensureMathJaxReady();
    return renderMath(math, false);
  } catch (error) {
    logger.error('MathJax inline math render error:', error);
    return `\\(${math}\\)`;
  }
};

export const renderMathDisplayAsync = async (math: string): Promise<string> => {
  try {
    await ensureMathJaxReady();
    return `<div class="math-display">${renderMath(math, true)}</div>`;
  } catch (error) {
    logger.error('MathJax display math render error:', error);
    return `<div class="math-display">\\[${math}\\]</div>`;
  }
};

export const isMathJaxReady = (): boolean => {
  return mathJaxInitialized;
};

export const initializeMathJax = async (): Promise<void> => {
  await initMathJax();
};
