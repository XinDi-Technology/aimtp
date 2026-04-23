import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import mdHighlightJs from 'markdown-it-highlightjs';
import mdTaskLists from 'markdown-it-task-lists';
import mdFootnote from 'markdown-it-footnote';
import mdIns from 'markdown-it-ins';
import mdMark from 'markdown-it-mark';
import mdSub from 'markdown-it-sub';
import mdSup from 'markdown-it-sup';
import mdGithubAlerts from 'markdown-it-github-alerts';
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
  githubAlerts: boolean;
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
    highlight: function (str: string, lang: string): string {
      // 如果启用代码高亮
      if (options.codeHighlight && lang && hljs.getLanguage(lang)) {
        try {
          // 得到经过highlight.js之后的html代码
          const preCode: string = hljs.highlight(str, { language: lang }).value;
          
          // 以换行进行分割
          const lines: string[] = preCode.split(/\n/).slice(0, -1);
          
          // 如果启用行号（包括单行）
          if (options.showLineNumbers && lines.length > 0) {
            // 添加自定义行号
            let html: string = lines.map((item: string, index: number) => {
              return '<li><span class="line-num" data-line="' + (index + 1) + '"></span>' + item + '</li>';
            }).join('');
            html = '<ol class="code-lines">' + html + '</ol>';
            return '<pre class="hljs"><code>' + html + '</code></pre>';
          } else {
            // 不显示行号，返回普通高亮代码
            let html: string = '<pre class="hljs"><code>' + preCode + '</code></pre>';
            // 添加代码语言标签
            if (lang) {
              html = html.replace('</code>', '</code><b class="lang-name">' + lang + '</b>');
            }
            return html;
          }
        } catch (__) {}
      }
      
      // 未启用代码高亮或未指定语言，转义后返回
      const preCode: string = md.utils.escapeHtml(str);
      const lines: string[] = preCode.split(/\n/).slice(0, -1);
      
      // 如果启用行号（包括单行）
      if (options.showLineNumbers && lines.length > 0) {
        let html: string = lines.map((item: string, index: number) => {
          return '<li><span class="line-num" data-line="' + (index + 1) + '"></span>' + item + '</li>';
        }).join('');
        html = '<ol class="code-lines">' + html + '</ol>';
        return '<pre class="hljs"><code>' + html + '</code></pre>';
      }
      
      // 不显示行号，返回普通代码
      let html: string = '<pre class="hljs"><code>' + preCode + '</code></pre>';
      // 添加代码语言标签（如果有语言标识）
      if (lang) {
        html = html.replace('</code>', '</code><b class="lang-name">' + lang + '</b>');
      }
      return html;
    }
  });

  if (options.codeHighlight) {
    // 代码高亮已经在 highlight 配置函数中处理，不需要额外插件
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

  if (options.githubAlerts) {
    // 使用 GitHub Alerts 插件
    md.use(mdGithubAlerts);
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
