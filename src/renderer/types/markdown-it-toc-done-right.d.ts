// 类型声明：markdown-it-toc-done-right 未自带 TypeScript 类型
// 仅声明本项目实际使用到的选项与默认导出签名。
declare module 'markdown-it-toc-done-right' {
  import type MarkdownIt from 'markdown-it';

  export interface TocDoneRightOptions {
    /** TOC 占位符正则源字符串，默认匹配 [[toc]]；此处改为 Typora 风格的 [TOC] */
    placeholder?: string;
    /** 纳入目录的标题级别：数字（最大层级）或数组（具体层级，如 [1,2,3]） */
    level?: number | number[];
    /** 目录容器 CSS 类名 */
    containerClass?: string;
    /** 目录容器 id */
    containerId?: string;
    listClass?: string;
    itemClass?: string;
    linkClass?: string;
    /** 列表类型 */
    listType?: 'ul' | 'ol';
    /** 生成 slug 的函数 */
    slugify?: (str: string) => string;
    /** 唯一 slug 起始索引 */
    uniqueSlugStartIndex?: number;
    /** 标题文本格式化回调 */
    format?: (text: string) => string;
    callback?: (html: string, ast: unknown) => void;
  }

  export default function tocDoneRight(
    md: MarkdownIt,
    options?: TocDoneRightOptions,
  ): void;
}
