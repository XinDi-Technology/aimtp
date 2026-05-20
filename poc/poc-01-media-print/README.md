# POC-01: @media print 在 printToPDF 中生效验证

## 运行方式

```bash
cd aimtp
node poc/poc-01-media-print/test.mjs
```

## 验证标准

1. 含 `@media print` 规则的 PDF 有恰好 3 页（每页一个 .page div）
2. PDF 中包含 "(print mode)" 标记（证明 @media print 规则生效）
3. 有/无 @media print 的 PDF 输出不同（证明是自定义规则生效，非默认行为）

## 输出

- `poc/poc-01-media-print/output/with-media-print.pdf` — 含 @media print 的 PDF
- `poc/poc-01-media-print/output/without-media-print.pdf` — 不含 @media print 的 PDF

## 关键验证点

| 验证项 | 说明 |
|--------|------|
| V1 | @media print 中 `position: static !important` + `break-after: page` 使每个 .page 在单独 PDF 页 |
| V2 | `.page-counter::after` 的 `content: " (print mode)"` 在 PDF 中出现（红色加粗） |
| V3 | 无 @media print 时，.page 保持 `position: relative`（screen 模式），打印行为不同 |
