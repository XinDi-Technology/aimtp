/**
 * Build script: Bundle pagedjs ESM into a standalone IIFE for iframe injection.
 *
 * Usage: node scripts/build-pagedjs-iife.mjs
 * Output: src/renderer/assets/vendor/pagedjs.iife.js
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { build } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, '../src/renderer/assets/vendor');
const OUTPUT_FILE = resolve(OUTPUT_DIR, 'pagedjs.iife.js');

const IIFE_HELPERS = `
// ─── Aimtp IIFE Helpers ───
if (typeof window !== 'undefined' && window.__pagedjs) {
  window.__pagedjs.createPreviewer = function() {
    return new window.__pagedjs.Previewer();
  };
  window.__pagedjs.createHandler = function() {
    return new window.__pagedjs.Handler();
  };
}
`;

async function buildPagedJsIIFE() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('[build-pagedjs-iife] Bundling pagedjs ESM → IIFE...');

  const result = await build({
    root: resolve(__dirname, '..'),
    logLevel: 'warn',
    configFile: false,
    build: {
      write: false,
      lib: {
        entry: resolve(__dirname, '../node_modules/pagedjs/dist/paged.js'),
        name: '__pagedjs',
        formats: ['iife'],
        fileName: () => 'pagedjs.iife',
      },
      rolldownOptions: {
        output: {
          extend: true,
          footer: IIFE_HELPERS,
        },
      },
      minify: 'oxc',
    },
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  // Vite 8 build() returns RollupOutput | RollupOutput[]
  // RollupOutput has .output: OutputChunk[]
  const outputs = Array.isArray(result) ? result : [result];
  let iifeCode = '';

  for (const rollupOutput of outputs) {
    // rollupOutput is RollupOutput, its .output is the array of chunks/assets
    const chunks = rollupOutput.output || [];
    for (const chunk of chunks) {
      if (chunk.type === 'chunk' && chunk.isEntry) {
        iifeCode = chunk.code;
        break;
      }
    }
    if (iifeCode) break;
  }

  if (!iifeCode) {
    throw new Error('[build-pagedjs-iife] Failed to extract IIFE code from Vite build output');
  }

  writeFileSync(OUTPUT_FILE, iifeCode, 'utf-8');
  const sizeKB = (iifeCode.length / 1024).toFixed(1);
  console.log(`[build-pagedjs-iife] ✓ Output: ${OUTPUT_FILE} (${sizeKB} KB)`);
}

buildPagedJsIIFE();
