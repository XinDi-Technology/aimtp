/**
 * Highlight.js 主题样式（本地化，无 CDN 依赖）
 * 来源：https://github.com/highlightjs/highlight.js/tree/main/src/styles
 * 
 * 使用方式：
 * import { getHljsTheme } from './hljsThemes';
 * const css = getHljsTheme('github');
 */

/**
 * 根据主题名称获取对应的 CSS 样式
 */
export const getHljsTheme = (theme: string): string => {
  const themes: Record<string, string> = {
    github: `.hljs{color:#24292e;background:#fff}.hljs-doctag,.hljs-keyword,.hljs-meta .hljs-keyword,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable.language_{color:#d73a49}.hljs-title,.hljs-title.class_,.hljs-title.class_.inherited__,.hljs-title.function_{color:#6f42c1}.hljs-attr,.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id,.hljs-variable{color:#005cc5}.hljs-meta .hljs-string,.hljs-regexp,.hljs-string{color:#032f62}.hljs-built_in,.hljs-symbol{color:#e36209}.hljs-code,.hljs-comment,.hljs-formula{color:#6a737d}.hljs-name,.hljs-quote,.hljs-selector-pseudo,.hljs-selector-tag{color:#22863a}.hljs-subst{color:#24292e}.hljs-section{color:#005cc5;font-weight:700}.hljs-bullet{color:#735c0f}.hljs-emphasis{color:#24292e;font-style:italic}.hljs-strong{color:#24292e;font-weight:700}.hljs-addition{color:#22863a;background:#f0fff4}.hljs-deletion{color:#b31d28;background:#ffeef0}.hljs-char.escape_,.hljs-link,.hljs-params,.hljs-property,.hljs-punctuation,.hljs-tag{color:#24292e}`,

    monokai: `.hljs{color:#f8f8f2;background:#272822}.hljs-comment,.hljs-quote{color:#75715e}.hljs-variable,.hljs-template-variable,.hljs-tag,.hljs-name,.hljs-selector-id,.hljs-selector-class,.hljs-regexp,.hljs-deletion{color:#f92672}.hljs-number,.hljs-built_in,.hljs-literal,.hljs-type,.hljs-params,.hljs-meta,.hljs-link{color:#ae81ff}.hljs-attribute{color:#e6db74}.hljs-string,.hljs-symbol,.hljs-bullet,.hljs-addition{color:#a6e22e}.hljs-title,.hljs-section{color:#a6e22e}.hljs-keyword,.hljs-selector-tag{color:#66d9ef}.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:700}`,

    dracula: `.hljs{color:#f8f8f2;background:#282a36}.hljs-comment,.hljs-quote{color:#6272a4}.hljs-variable,.hljs-template-variable,.hljs-tag,.hljs-name,.hljs-selector-id,.hljs-selector-class,.hljs-regexp,.hljs-deletion{color:#ff5555}.hljs-number,.hljs-built_in,.hljs-literal,.hljs-type,.hljs-params,.hljs-meta,.hljs-link{color:#bd93f9}.hljs-attribute,.hljs-string,.hljs-symbol,.hljs-bullet,.hljs-addition{color:#50fa7b}.hljs-title,.hljs-section{color:#8be9fd}.hljs-keyword,.hljs-selector-tag{color:#ff79c6}.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:700}.hljs-function .hljs-title,.hljs-title.function_{color:#50fa7b}.hljs-keyword,.hljs-selector-tag{color:#ff79c6}`,
  };

  return themes[theme] || themes.github;
};

/**
 * 获取 hljs 基础样式（.hljs 类本身的样式）
 */
export const getHljsBaseStyles = (): string => {
  return `.hljs{display:block;overflow-x:auto;padding:0.5em}.hljs,.hljs-subst,.hljs-title,.hljs-emphasis{font-style:italic}.hljs,.hljs-strong{font-weight:700}`;
};
