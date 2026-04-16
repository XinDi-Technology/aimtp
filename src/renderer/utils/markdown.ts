import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import mdHighlightJs from 'markdown-it-highlightjs';
import mdTaskLists from 'markdown-it-task-lists';
import mdFootnote from 'markdown-it-footnote';
import mdIns from 'markdown-it-ins';
import mdMark from 'markdown-it-mark';
import mdSub from 'markdown-it-sub';
import mdSup from 'markdown-it-sup';
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

export const createMarkdownIt = (options: MarkdownItOptions): MarkdownIt => {
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
    // 初始化 MathJax
    initMathJaxInstance();
    // 使用 MathJax 插件
    md.use(mathjaxPlugin);
  }

  if (options.mermaid) {
    // 初始化 Mermaid
    initMermaidInstance();
    // 使用自定义 Mermaid 插件
    md.use(mermaidPlugin);
  }

  return md;
};

export const resetMarkdownIt = (options: MarkdownItOptions): MarkdownIt => {
  return createMarkdownIt(options);
};
