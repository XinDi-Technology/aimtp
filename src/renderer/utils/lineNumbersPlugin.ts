/**
 * Markdown It 行号插件
 * 为代码块添加行号显示
 */

import type MarkdownIt from 'markdown-it';

export interface LineNumbersOptions {
  singleLine?: boolean; // 是否为单行代码也显示行号
}

export default function lineNumbersPlugin(md: MarkdownIt, options: LineNumbersOptions = {}) {
  const { singleLine = false } = options;

  // 保存原始的 fence 渲染器
  const defaultFenceRenderer = md.renderer.rules.fence || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  // 重写 fence 渲染器
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const content = token.content;
    
    // 调用原始渲染器获取高亮后的 HTML
    let result = defaultFenceRenderer(tokens, idx, options, env, self);
    
    // 计算行数
    const lines = content.split('\n');
    // 如果最后一行为空，移除它（因为 split 会产生额外的空元素）
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    
    const lineCount = lines.length;
    
    // 如果只有一行且不显示单行行号，直接返回
    if (lineCount <= 1 && !singleLine) {
      return result;
    }
    
    // 生成行号 HTML
    let lineNumbersHtml = '<div class="code-line-numbers">';
    for (let i = 1; i <= lineCount; i++) {
      lineNumbersHtml += `<span class="line-number">${i}</span>`;
    }
    lineNumbersHtml += '</div>';
    
    // 将行号插入到 <pre> 标签内
    result = result.replace('<pre', `<pre class="with-line-numbers"`);
    result = result.replace('<code>', `${lineNumbersHtml}<code>`);
    
    return result;
  };
}
