import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const indexPath = resolve(__dirname, '../dist/renderer/index.html');

try {
  let html = readFileSync(indexPath, 'utf-8');
  
  // 将 crossorigin="" 替换为 crossorigin="anonymous"
  html = html.replace(/crossorigin=""/g, 'crossorigin="anonymous"');
  
  writeFileSync(indexPath, html);
  console.log('Fixed crossorigin attributes in index.html');
} catch (err) {
  console.error('Failed to fix crossorigin:', err.message);
}
