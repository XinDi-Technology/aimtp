import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath, URL } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const indexPath = resolve(__dirname, '../dist/renderer/index.html');

try {
  let html = readFileSync(indexPath, 'utf-8');
  
  // 更加健壮的替换逻辑
  html = html.replace(/crossorigin(="[^"]*"|='[^']*'|(?!\s*>))?/g, 'crossorigin="anonymous"');
  
  writeFileSync(indexPath, html);
  console.log('Fixed crossorigin attributes in index.html');
} catch (err) {
  console.error('Failed to fix crossorigin:', err.message);
}
