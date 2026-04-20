import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import mdHighlightJs from 'markdown-it-highlightjs';
import mdTaskLists from 'markdown-it-task-lists';
import mdFootnote from 'markdown-it-footnote';
import mdIns from 'markdown-it-ins';
import mdMark from 'markdown-it-mark';
import mdSub from 'markdown-it-sub';
import mdSup from 'markdown-it-sup';
import lineNumbersPlugin from './lineNumbersPlugin';
import { mathjaxPlugin, initMathJaxInstance } from './mathjaxPlugin';
import { mermaidPlugin, initMermaidInstance } from './mermaidPlugin';

export { hljs };

export interface MarkdownItOptions {
  codeHighlight: boolean;
  showLineNumbers: boolean;
  taskLists: boolean;
  footnotes: boolean;
  mermaid: boolean;
  mathJax: boolean;
  mark: boolean;
  ins: boolean;
  sub: boolean;
  sup: boolean;
  codeTheme?: string;
}

// TODO: [P2-问题5] 缓存无清理机制，可能导致内存泄漏
// 如果用户频繁切换扩展设置，会产生大量缓存实例
// 建议：限制缓存大小或使用 LRU 策略
const mdCache = new Map<string, MarkdownIt>();

/**
 * 根据选项生成唯一的缓存键
 */
const getCacheKey = (options: MarkdownItOptions): string => {
  return JSON.stringify(options);
};

export const createMarkdownIt = (options: MarkdownItOptions): MarkdownIt => {
  const cacheKey = getCacheKey(options);
  if (mdCache.has(cacheKey)) {
    return mdCache.get(cacheKey)!;
  }

  const md = new MarkdownIt({
    html: true,
    breaks: true,
    linkify: true,
    typographer: true,
  });

  if (options.codeHighlight) {
    md.use(mdHighlightJs, {
      auto: true,
      hljs,
    });
  }

  // 如果启用行号，在代码高亮之后应用
  if (options.showLineNumbers) {
    md.use(lineNumbersPlugin);
  }

  if (options.taskLists) {
    md.use(mdTaskLists);
  }

  if (options.footnotes) {
    md.use(mdFootnote);
  }

  if (options.mark) {
    md.use(mdMark);
  }

  if (options.ins) {
    md.use(mdIns);
  }

  if (options.sub) {
    md.use(mdSub);
  }

  if (options.sup) {
    md.use(mdSup);
  }

  if (options.mathJax) {
    // 使用 MathJax 插件
    md.use(mathjaxPlugin);
  }

  if (options.mermaid) {
    // 使用自定义 Mermaid 插件
    md.use(mermaidPlugin);
  }

  // 存入缓存
  mdCache.set(cacheKey, md);

  return md;
};

export const resetMarkdownIt = (options: MarkdownItOptions): MarkdownIt => {
  return createMarkdownIt(options);
};
