import { logger } from './logger';

let MathJax: any = null;

let mathJaxInitialized = false;
let mathJaxInitializing = false;
let mathJaxInitPromise: Promise<void> | null = null;

const initMathJax = async (): Promise<void> => {
  if (mathJaxInitialized) return;
  if (mathJaxInitializing && mathJaxInitPromise) return mathJaxInitPromise;

  mathJaxInitializing = true;
  mathJaxInitPromise = (async () => {
    try {
      const module = await import('mathjax');
      MathJax = module.default || module;

      await MathJax.init({
        loader: {
          load: ['input/tex', 'output/svg'],
        },
        tex: {
          packages: {
            '[+]': ['ams', 'newcommand', 'configmacros', 'bbox', 'extpfeil'],
          },
        },
        svg: {
          fontCache: 'global',
          localFontPath: '',
          localFontFamily: '',
        },
      });

      mathJaxInitialized = true;
      logger.log('MathJax initialized successfully with SVG output');
    } catch (error) {
      mathJaxInitialized = false;
      mathJaxInitPromise = null;
      logger.error('Failed to initialize MathJax:', error);
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