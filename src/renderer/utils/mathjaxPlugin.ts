import { logger } from './logger';

let MathJax: any = null;

let mathJaxInitialized = false;
let mathJaxInitializing = false;
let mathJaxInitPromise: Promise<void> | null = null;
let mathJaxLoadFailed = false; // 加载永久失败后不再重试

const MATHJAX_SCRIPT_TIMEOUT = 15000; // tex-svg.js 加载超时 15s

/**
 * 动态按需加载 MathJax tex-svg.js 脚本。
 * 只在首次需要使用 MathJax 时才加载，避免启动时无条件加载 1.76 MB 脚本。
 */
const loadMathJaxScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // 如果脚本已通过其他方式加载，直接返回
    const mj = (window as any).MathJax;
    if (mj && mj.tex2svgPromise) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = './vendor/tex-svg.js';

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

const initMathJax = async (): Promise<void> => {
  if (mathJaxInitialized) return;
  if (mathJaxLoadFailed) {
    throw new Error('MathJax previously failed to load — not retrying');
  }
  if (mathJaxInitializing && mathJaxInitPromise) return mathJaxInitPromise;

  mathJaxInitializing = true;
  mathJaxInitPromise = (async () => {
    try {
      // 动态加载 tex-svg.js（仅在首次需要时）
      await loadMathJaxScript();

      const mj = (window as any).MathJax;
      if (!mj || !mj.tex2svgPromise) {
        throw new Error('MathJax script loaded but tex2svgPromise not available');
      }
      MathJax = mj;

      mathJaxInitialized = true;
      logger.log('MathJax initialized successfully with SVG output');
    } catch (error) {
      mathJaxInitialized = false;
      mathJaxLoadFailed = true;
      mathJaxInitPromise = null;
      logger.error('Failed to initialize MathJax:', error);
      throw error; // 上抛给调用方处理
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

export const isMathJaxReady = (): boolean => {
  return mathJaxInitialized;
};

export const initializeMathJax = async (): Promise<void> => {
  await initMathJax();
};
