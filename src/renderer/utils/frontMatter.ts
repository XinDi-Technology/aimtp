/**
 * YAML Front Matter 解析工具
 * 使用简单的正则表达式和手动解析，零依赖
 */

export interface FrontMatterData {
  title?: string;
  author?: string;
  date?: string | Date;
  tags?: string[];
  [key: string]: any;
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
 */
export function formatDate(date: string | Date | undefined, locale: string = 'zh'): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';

  return dateObj.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
