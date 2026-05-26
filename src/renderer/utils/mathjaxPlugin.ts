import { logger } from './logger';

let mathJaxInitialized = false;
let mathJaxInitializing = false;
let mathJaxInitPromise: Promise<void> | null = null;
let mathJaxLoadFailed = false;

const MATHJAX_SCRIPT_TIMEOUT = 15000;
const MATHJAX_FONT_LOAD_TIMEOUT = 30000;
const MATHJAX_RENDER_TIMEOUT = 8000;

// 本地字体文件路径（相对于 MathJax 脚本所在目录 vendor/）
// 注意：MathJax 从脚本所在目录解析 dynamicPrefix，而脚本在 vendor/ 下，
// 所以路径是 ./mathjax-newcm-font/svg/dynamic，而不是 ./vendor/mathjax-newcm-font/svg/dynamic
const LOCAL_DYNAMIC_PREFIX = './mathjax-newcm-font/svg/dynamic';

/**
 * 动态按需加载 MathJax v4 tex-mml-svg-mathjax-newcm.js 脚本。
 *
 * 该组件包含 MathJax 核心 + TeX 输入 + MathML 输入 + SVG 输出 + mathjax-newcm 字体注册。
 * 字体字符路径数据存储在 svg/dynamic/*.js 中（按字符范围分片），
 * 需要配置 svg.dynamicPrefix 指向本地目录以支持离线/Electron/ASAR 环境。
 */
const loadMathJaxScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-mathjax-tex-svg]');
    if (existing) {
      logger.log('[MathJax] Script tag already exists, skipping load');
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = './vendor/tex-mml-svg-mathjax-newcm.js';
    script.setAttribute('data-mathjax-tex-svg', 'true');
    logger.log('[MathJax] Loading script from:', script.src);

    const timeout = setTimeout(() => {
      cleanup();
      logger.error('[MathJax] Script load TIMEOUT after', MATHJAX_SCRIPT_TIMEOUT, 'ms');
      reject(new Error('MathJax script load timeout'));
    }, MATHJAX_SCRIPT_TIMEOUT);

    const cleanup = () => {
      clearTimeout(timeout);
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };

    const onLoad = () => {
      cleanup();
      logger.log('[MathJax] Script load event fired');
      resolve();
    };

    const onError = (e: Event) => {
      cleanup();
      logger.error('[MathJax] Script load ERROR:', e);
      reject(new Error('MathJax script failed to load'));
    };

    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    document.head.appendChild(script);
  });
};

/**
 * 等待 MathJax v4 初始化完成，并强制覆盖 dynamicPrefix 为本地路径。
 *
 * tex-mml-svg-mathjax-newcm.js 脚本内部会通过 dC() 设置
 * dynamicPrefix 为 CDN 路径（如 @mathjax/mathjax-newcm-font/svg/dynamic），
 * 可能覆盖 index.html 中的用户配置。因此必须在 startup.promise
 * resolve 后强制覆盖回本地路径。
 */
const waitForMathJaxReady = async (): Promise<void> => {
  const mj = (window as any).MathJax;

  if (!mj) {
    throw new Error('MathJax global object not found after script load');
  }

  if (mj.startup && typeof mj.startup.promise?.then === 'function') {
    logger.log('[MathJax] Waiting for startup.promise...');
    await mj.startup.promise;
    logger.log('[MathJax] startup.promise resolved');
  } else {
    logger.log('[MathJax] No startup.promise, polling for API...');
    const startTime = Date.now();
    while (typeof mj.tex2svg !== 'function') {
      if (Date.now() - startTime > 10000) {
        throw new Error('MathJax init timeout: tex2svg not available');
      }
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // 关键修复：强制覆盖 dynamicPrefix 为本地路径
  // 脚本的 dC() 自动配置可能将 dynamicPrefix 覆盖为 CDN 路径，
  // 导致 Electron/ASAR 环境下无法加载动态字体文件。
  try {
    const outputJax = mj.startup?.outputJax || mj.startup?.document?.outputJax;
    if (outputJax?.font?.options) {
      const oldPrefix = outputJax.font.options.dynamicPrefix;
      outputJax.font.options.dynamicPrefix = LOCAL_DYNAMIC_PREFIX;
      logger.log('[MathJax] Forced dynamicPrefix:', oldPrefix, '->', LOCAL_DYNAMIC_PREFIX);
    } else {
      logger.warn('[MathJax] Could not find outputJax.font.options to override dynamicPrefix');
    }
  } catch (e) {
    logger.error('[MathJax] Failed to override dynamicPrefix:', e);
  }

  const hasSync = typeof mj.tex2svg === 'function';
  const hasPromise = typeof mj.tex2svgPromise === 'function';
  const hasAdaptor = !!(mj.startup?.adaptor?.outerHTML);
  logger.log('[MathJax] Ready. tex2svg:', hasSync, 'tex2svgPromise:', hasPromise, 'adaptor:', hasAdaptor);

  if (!hasSync && !hasPromise) {
    throw new Error('MathJax initialized but no rendering API available');
  }
};

/**
 * 预加载所有动态字体文件。
 *
 * MathJax v4 将字体数据拆分为多个小文件（svg/dynamic/*.js），
 * 按需加载以减少初始包体积。在 Electron/ASAR/file:// 环境下，
 * 运行时动态加载可能失败（file:// 协议限制 + ASAR 路径问题），
 * 因此在初始化时一次性预加载所有字体数据。
 *
 * 参考：https://docs.mathjax.org/en/latest/output/fonts.html
 */
const preloadDynamicFonts = async (): Promise<void> => {
  const mj = (window as any).MathJax;

  // 尝试多种路径查找 font 对象
  const font =
    mj.startup?.outputJax?.font ||
    mj.startup?.document?.outputJax?.font ||
    null;

  if (!font) {
    logger.log('[MathJax] No font object found, skipping font preloading');
    return;
  }

  logger.log('[MathJax] Font object found. loadDynamicFiles:', typeof font.loadDynamicFiles, 'dynamicPrefix:', font.options?.dynamicPrefix);

  if (typeof font.loadDynamicFiles === 'function') {
    logger.log('[MathJax] Preloading all dynamic font files...');
    try {
      await Promise.race([
        font.loadDynamicFiles(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Font preload timeout')), MATHJAX_FONT_LOAD_TIMEOUT),
        ),
      ]);
      logger.log('[MathJax] Dynamic font files preloaded successfully');
    } catch (error) {
      logger.warn('[MathJax] Font preload failed (will try per-character loading):', error);
    }
  } else {
    logger.log('[MathJax] loadDynamicFiles not available on font object, fonts will load on demand');
  }
};

const initMathJax = async (): Promise<void> => {
  if (mathJaxInitialized) return;
  if (mathJaxLoadFailed) {
    throw new Error('MathJax previously failed to load — not retrying');
  }
  if (mathJaxInitializing && mathJaxInitPromise) return mathJaxInitPromise;

  mathJaxInitializing = true;
  logger.log('[MathJax] Starting initialization...');

  mathJaxInitPromise = (async () => {
    try {
      await loadMathJaxScript();
      await waitForMathJaxReady();
      await preloadDynamicFonts();
      mathJaxInitialized = true;
      logger.log('[MathJax] Initialized successfully');
    } catch (error) {
      mathJaxInitialized = false;
      mathJaxLoadFailed = true;
      mathJaxInitPromise = null;
      logger.error('[MathJax] Init FAILED:', error);
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
 * 将 MathJax 输出节点序列化为 HTML 字符串（重复警告 5s 内只打印一次）
 */
let _lastSerializeWarn = 0;
const serializeNode = (node: any, mj: any): string => {
  if (!node) {
    logger.error('[MathJax] serializeNode: node is null/undefined');
    return '';
  }

  if (mj.startup?.adaptor?.outerHTML) {
    try {
      const html = mj.startup.adaptor.outerHTML(node);
      if (html && html.length > 0) {
        return html;
      }
      if (Date.now() - _lastSerializeWarn > 5000) {
        _lastSerializeWarn = Date.now();
        logger.warn('[MathJax] adaptor.outerHTML returned empty');
      }
    } catch (e) {
      logger.error('[MathJax] adaptor.outerHTML threw:', e);
    }
  }

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
    logger.error('[MathJax] All serialization methods failed');
    return '';
  }
};

/**
 * 带超时的 Promise 包装器
 */
const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms),
    ),
  ]);
};

/**
 * 使用 MathJax v4 渲染数学公式。
 *
 * 渲染策略（按优先级，所有方法均有超时保护）：
 * 1. tex2svg + handleRetriesFor — 同步渲染 + 重试处理
 *    预加载字体后，同步调用不会触发动态字体加载，最可靠
 * 2. tex2svgPromise — v4 推荐异步 API
 * 3. typesetPromise — DOM 排版方式（最终回退）
 */
const renderMath = async (math: string, display: boolean): Promise<string> => {
  await ensureMathJaxReady();

  const mj = (window as any).MathJax;
  logger.log('[MathJax] renderMath called, display:', display, 'math length:', math.length);

  // 方法 1: tex2svg 同步 + handleRetriesFor（字体预加载后最可靠）
  if (typeof mj.tex2svg === 'function') {
    try {
      logger.log('[MathJax] Trying tex2svg (sync) with handleRetriesFor...');
      let node: any;
      if (typeof mj.handleRetriesFor === 'function') {
        node = await withTimeout(
          mj.handleRetriesFor(() => mj.tex2svg(math, { display })),
          MATHJAX_RENDER_TIMEOUT,
          'tex2svg+handleRetriesFor',
        );
      } else {
        node = mj.tex2svg(math, { display });
      }
      const html = serializeNode(node, mj);
      if (html) {
        logger.log('[MathJax] tex2svg succeeded, HTML length:', html.length);
        return html;
      }
      logger.warn('[MathJax] tex2svg returned empty result');
    } catch (error) {
      logger.error('[MathJax] tex2svg failed:', error);
    }
  }

  // 方法 2: tex2svgPromise（带超时防护）
  if (typeof mj.tex2svgPromise === 'function') {
    try {
      const node = await withTimeout(
        mj.tex2svgPromise(math, { display }),
        5000,
        'tex2svgPromise',
      );
      const html = serializeNode(node, mj);
      if (html) {
        logger.log('[MathJax] tex2svgPromise succeeded, HTML length:', html.length);
        return html;
      }
    } catch (error) {
      logger.error('[MathJax] tex2svgPromise failed:', error);
    }
  }

  // 方法 3: typesetPromise（DOM 排版方式）
  if (typeof mj.typesetPromise === 'function') {
    try {
      const container = document.createElement('div');
      container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none';
      container.textContent = display ? `$$${math}$$` : `\\(${math}\\)`;
      document.body.appendChild(container);

      await withTimeout(mj.typesetPromise([container]), 10000, 'typesetPromise');

      const html = container.innerHTML;
      container.remove();
      if (html) {
        logger.log('[MathJax] typesetPromise succeeded, HTML length:', html.length);
        return html;
      }
    } catch (error) {
      logger.error('[MathJax] typesetPromise failed:', error);
    }
  }

  throw new Error('All MathJax rendering methods failed');
};

export const renderMathInlineAsync = async (math: string): Promise<string> => {
  try {
    return await renderMath(math, false);
  } catch (error) {
    logger.error('[MathJax] Inline render error:', error);
    return `\\(${math}\\)`;
  }
};

export const renderMathDisplayAsync = async (math: string): Promise<string> => {
  try {
    const html = await renderMath(math, true);
    return `<div class="math-display">${html}</div>`;
  } catch (error) {
    logger.error('[MathJax] Display render error:', error);
    return `<div class="math-display">\\[${math}\\]</div>`;
  }
};

export const isMathJaxReady = (): boolean => {
  return mathJaxInitialized;
};

export const initializeMathJax = async (): Promise<void> => {
  await initMathJax();
};
