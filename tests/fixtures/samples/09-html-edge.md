# 09 原始 HTML 与边界用例

> 用途：区分「支持的 HTML」「预期内不支持的 HTML」「排版边界」。本文件中的「丢弃」项属于设计行为，不应登记为缺陷。

## 应当正常渲染的 HTML

行内标签：这是 <b>粗体</b>、这是 <i>斜体</i>、这是 <s>删除线</s>、这是 <kbd>Ctrl</kbd> + <kbd>S</kbd> 按键。

强制换行标签：第一行<br>第二行应当另起一行。

行内样式：<span style="color: #8250df;">这段文字应当显示为紫色</span>。

块级容器：<div style="text-align: center;">这段文字应当居中</div>。

换行后的普通段落。

## 预期内不支持、会被静默丢弃的写法

`<u>` 标签不被支持：这是 <u>带下划线标签的文本</u>，渲染后应只保留文本内容而失去下划线效果，请改用 ++下划线文本++ 语法。

定义列表不被支持：

<dl>
<dt>术语</dt>
<dd>描述文本，这组标签会被丢弃，只可能残留文字。</dd>
</dl>

`<iframe>` 不被支持：下方不应出现任何嵌入框。

<iframe src="https://example.com"></iframe>

`<video>` 不被支持：下方不应出现播放器。

<video src="./missing.mp4"></video>

## 排版边界

多个连续空格会被合并：这个词之间     有五个空格。

全角空格：中文　文档　之间的全角空格应当保留。

超长英文单词应当正常换行或溢出处理：hyphenation-example-of-a-very-long-token-without-any-space-inside。

超长网址应当正常换行或溢出处理：https://github.com/XinDi-Technology/aimtp/blob/main/tests/fixtures/samples/09-html-and-edge-cases-and-more-text.md

连续标点：标点符号！！！应当不触发额外的间距规则。

中英混排边界：Aimtp（Markdown to PDF）中文与 English 混排、数字 100 个单位与百分号 99% 之间应保持自然的间距。

引号与排版符号：英文双引号 "Aimtp" 应渲染为排版引号；两连字符 A -- B 应渲染为短破折号；三个连续的点 ... 应渲染为省略号。

位于页面最末行的内容：请把本段放置在页面底部附近，用于验证末行文字不会被页脚区域遮挡。这一行是本文档的最后一行文本。

