/**
 * 按二级标题（H2）分割 Markdown 内容
 * @param markdown 原始 Markdown 文本
 * @returns 分割后的页面数组，每个元素包含标题和内容
 */
export interface PageSection {
  title: string;      // H2 标题文本
  content: string;    // 该章节的 Markdown 内容（包含 H2 标题）
}

export function splitMarkdownByH2(markdown: string): PageSection[] {
  if (!markdown || !markdown.trim()) {
    return [];
  }

  // 先去除 Front Matter
  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const contentWithoutFM = markdown.replace(frontMatterRegex, '');
  
  if (!contentWithoutFM.trim()) {
    return [];
  }

  const lines = contentWithoutFM.split('\n');
  const sections: PageSection[] = [];
  let currentTitle = '';
  let currentContent: string[] = [];
  let hasContentBeforeFirstH2 = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h2Match = line.match(/^##\s+(.+)$/);

    if (h2Match) {
      // 遇到新的 H2 标题
      if (currentTitle || hasContentBeforeFirstH2) {
        // 保存之前的章节
        sections.push({
          title: currentTitle || '前言',
          content: currentContent.join('\n'),
        });
      }
      
      currentTitle = h2Match[1].trim();
      currentContent = [line]; // 包含 H2 标题本身
      hasContentBeforeFirstH2 = false;
    } else {
      // 非 H2 行
      if (!currentTitle && line.trim()) {
        // H2 之前的内容
        hasContentBeforeFirstH2 = true;
        currentContent.push(line);
      } else if (currentTitle) {
        // 当前章节的内容
        currentContent.push(line);
      }
    }
  }

  // 保存最后一个章节
  if (currentTitle || hasContentBeforeFirstH2) {
    sections.push({
      title: currentTitle || '前言',
      content: currentContent.join('\n'),
    });
  }

  // 如果没有找到任何 H2，返回整个内容作为一个页面
  if (sections.length === 0 && contentWithoutFM.trim()) {
    sections.push({
      title: '文档',
      content: contentWithoutFM,
    });
  }

  return sections;
}

/**
 * 获取页面数量
 */
export function getPageCount(markdown: string): number {
  const sections = splitMarkdownByH2(markdown);
  return Math.max(1, sections.length);
}
