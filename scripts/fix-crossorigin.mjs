import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath, URL } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
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
