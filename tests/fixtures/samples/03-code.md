# 03 代码块与语法高亮

> 用途：验证代码字体、高亮主题、行号、语言回退。
> 对应设置：代码字体、代码高亮主题（GitHub / Monokai / Dracula）、显示代码行号（开 / 关各测一次）。

行内代码：`const answer = 42;` 应与周围中文正文基线协调。

JavaScript：

```javascript
function greet(name) {
  const message = "你好，" + name;
  console.log(message);
  return message;
}
```

TypeScript：

```typescript
interface Page {
  index: number;
  title: string;
}

export function renderPage(page: Page): HTMLElement {
  const el = document.createElement("section");
  el.dataset.index = String(page.index);
  return el;
}
```

Python：

```python
def fib(n: int) -> int:
    """计算第 n 项斐波那契数。"""
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
```

Bash：

```bash
# 安装依赖并打包
npm install
npm run build:win
```

JSON：

```json
{
  "name": "aimtp",
  "version": "0.1.0",
  "private": true,
  "engines": {
    "node": ">=24.0.0"
  }
}
```

HTML：

```html
<section class="page">
  <h1>预览页</h1>
  <p>用于验证 HTML 语言的着色。</p>
</section>
```

CSS：

```css
.page {
  padding: 12mm;
  line-height: 2;
}
```

Go：

```go
package main

import "fmt"

func main() {
    fmt.Println("aimtp")
}
```

SQL：

```sql
SELECT title, author, created_at
FROM documents
WHERE author = 'aimtp'
ORDER BY created_at DESC;
```

YAML：

```yaml
title: 特性覆盖测试文档
author: Aimtp
date: 2026-10-07
```

无语言的纯文本块：

```
这是一段未指定语言的代码块，
应当以等宽字体原样输出，不做着色。
```

未注册语言（回退验证，不做着色且须正确转义）：

```aimtplang
token <tag> & "quote" 应被正确转义显示
```

超长单行代码（验证是否溢出页面，或是否出现横向裁切）：

```javascript
const veryLongSingleLine = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
```

代码含中文注释与空行（验证中文字形与行间距）：

```javascript
// 中文注释应当使用代码字体中的字形。
const placeholder = 1;

// 上方是一个空行，用于观察换行行距。
console.log(placeholder);
```

