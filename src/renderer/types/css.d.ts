/// <reference types="vite/client" />

declare module 'mathjax' {
  const mathjax: any;
  export default mathjax;
}

declare module 'markdown-it-sup' {
  const plugin: any;
  export default plugin;
}

declare module 'markdown-it-sub' {
  const plugin: any;
  export default plugin;
}

declare module 'markdown-it-mark' {
  const plugin: any;
  export default plugin;
}

declare module 'markdown-it-ins' {
  const plugin: any;
  export default plugin;
}

declare module 'markdown-it-task-lists' {
  const plugin: any;
  export default plugin;
}

declare module 'markdown-it-footnote' {
  import type MarkdownIt from 'markdown-it';
  const plugin: (md: MarkdownIt) => void;
  export default plugin;
}