// 类型声明：markdown-it-toc-and-anchor 未自带 TypeScript 类型
// 仅声明本项目实际使用到的选项与默认导出签名。
declare module 'markdown-it-toc-and-anchor' {
  import type MarkdownIt from 'markdown-it';

  export interface TocAndAnchorOptions {
    toc?: boolean;
    tocPattern?: RegExp;
    tocClassName?: string | null;
    tocFirstLevel?: number;
    tocLastLevel?: number;
    tocCallback?: ((html: string, ast: unknown) => void) | null;
    anchorLink?: boolean;
    anchorLinkSymbol?: string;
    anchorLinkSpace?: boolean;
    anchorLinkSymbolClassName?: string | null;
    anchorLinkBefore?: boolean;
    anchorLinkPrefix?: string;
    anchorClassName?: string;
    wrapHeadingTextInAnchor?: boolean;
    appendIdtoHeading?: boolean;
    resetIds?: boolean;
    slugify?: (str: string) => string;
  }

  export default function tocAndAnchor(
    md: MarkdownIt,
    options?: TocAndAnchorOptions,
  ): void;
}
