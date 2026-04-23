/// <reference types="vite/client" />

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.woff' {
  const content: string;
  export default content;
}

declare module '*.woff2' {
  const content: string;
  export default content;
}

declare module '*.ttf' {
  const content: string;
  export default content;
}

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

declare module 'pagedjs' {
  export class Previewer {
    preview(
      html: string,
      stylesheets: string[],
      target: HTMLElement
    ): Promise<{ total: number; pages: HTMLElement[] }>;
  }
}

declare module 'pagedjs/dist/paged.polyfill' {
  export { Previewer } from 'pagedjs';
}