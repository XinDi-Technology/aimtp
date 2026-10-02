/**
 * AimtpHandler — 页眉页脚相关类型定义
 *
 * 说明：早期的自定义 Paged.js Handler 基类与注册中心已移除——运行时从未注册过任何 Handler，
 * 页眉页脚由 PagedJsAdapter.injectHeaderFooterDom() 在 preview 结束后直接注入 DOM。
 */

/** 页眉页脚配置 */
export interface HeaderFooterConfig {
  enabled: boolean;
  header?: {
    content: 'title' | 'author' | 'date' | 'custom' | 'none';
    customText?: string;
    alignment: 'left' | 'center' | 'right';
    font?: string;
    fontSize?: string;
  };
  footer?: {
    content: 'pageNumber' | 'pageNumberTotal' | 'custom' | 'none';
    customText?: string;
    alignment: 'left' | 'center' | 'right';
    font?: string;
    fontSize?: string;
  };
  coverPageExempt: boolean;
}

/** Front matter 元数据 */
export interface FrontMatter {
  title?: string;
  author?: string;
  date?: string;
}
