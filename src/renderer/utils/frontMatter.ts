/**
 * YAML Front Matter 解析工具
 * 使用简单的正则表达式和手动解析，零依赖
 */

export interface FrontMatterData {
  title?: string;
  author?: string;
  date?: string | Date;
  tags?: string[];
  [key: string]: unknown;
}

/**
 * 从 Markdown 内容中提取 Front Matter
 * @param markdown Markdown 文本
 * @returns Front Matter 数据对象和去除 Front Matter 后的内容
 */
export function parseFrontMatter(markdown: string): {
  data: FrontMatterData;
  content: string;
} {
  if (!markdown || !markdown.trim()) {
    return { data: {}, content: markdown };
  }

  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = markdown.match(frontMatterRegex);

  if (!match) {
    return { data: {}, content: markdown };
  }

  const yamlContent = match[1];
  const content = markdown.slice(match[0].length);

  // 简单的 YAML 解析（支持基本的键值对）
  const data: FrontMatterData = {};
  const lines = yamlContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.substring(0, colonIndex).trim();
    let value = trimmed.substring(colonIndex + 1).trim();

    // 处理数组格式 [tag1, tag2]
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1);
      data[key] = value.split(',').map((item: string) => item.trim());
    }
    // 处理字符串
    else if (value.startsWith('"') && value.endsWith('"')) {
      data[key] = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      data[key] = value.slice(1, -1);
    }
    // 处理日期
    else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      data[key] = new Date(value);
    }
    // 处理布尔值
    else if (value === 'true' || value === 'false') {
      data[key] = value === 'true';
    }
    // 处理数字
    else if (/^\d+$/.test(value)) {
      data[key] = parseInt(value, 10);
    }
    // 默认字符串
    else {
      data[key] = value;
    }
  }

  return { data, content };
}

/**
 * 格式化 Front Matter 中的日期
 *
 * 与界面语言无关：按 YAML Front Matter 的常规写法原样呈现。
 * - 字符串（如 '2026-10-09'、'2026年10月9日'）直接沿用作者写法；
 * - Date 对象输出 YYYY-MM-DD。
 */
export function formatDate(date: string | Date | undefined): string {
  if (!date) return '';

  // 作者在 YAML 里怎么写就怎么显示，不做本地化转换
  if (typeof date === 'string') return date;

  if (isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
