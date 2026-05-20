/**
 * POC-01: @media print 在 printToPDF 中生效验证
 *
 * 验证目标：
 * 1. @media print CSS 规则在 Electron webContents.printToPDF() 中正确生效
 * 2. 与不含 @media print 规则时的默认打印行为不同
 * 3. .page 元素按 @media print 规则排列（静态定位 + 分页断点）
 *
 * 运行方式：node poc/poc-01-media-print/test.mjs
 */

import { app, BrowserWindow } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runTest() {
  await app.whenReady();

  const htmlPath = join(__dirname, 'index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  console.log('=== POC-01: @media print in printToPDF ===\n');

  // Test 1: With @media print rules
  console.log('Test 1: Generating PDF WITH @media print rules...');
  const pdfWithMediaPrint = await generatePdf(htmlContent);
  const withPageCount = countPdfPages(pdfWithMediaPrint);
  console.log(`  → PDF pages: ${withPageCount}`);
  console.log(`  → PDF size: ${pdfWithMediaPrint.length} bytes`);

  // Check if "(print mode)" text appears in the PDF
  const pdfTextWith = pdfWithMediaPrint.toString('latin1');
  const hasPrintModeMarker = pdfTextWith.includes('print mode');
  console.log(`  → Contains "(print mode)" marker: ${hasPrintModeMarker}`);

  // Test 2: Without @media print rules (strip @media print block)
  console.log('\nTest 2: Generating PDF WITHOUT @media print rules...');
  const htmlWithoutMediaPrint = stripMediaPrintBlock(htmlContent);
  const pdfWithoutMediaPrint = await generatePdf(htmlWithoutMediaPrint);
  const withoutPageCount = countPdfPages(pdfWithoutMediaPrint);
  console.log(`  → PDF pages: ${withoutPageCount}`);
  console.log(`  → PDF size: ${pdfWithoutMediaPrint.length} bytes`);

  const pdfTextWithout = pdfWithoutMediaPrint.toString('latin1');
  const hasScreenModeMarker = pdfTextWithout.includes('screen mode');
  console.log(`  → Contains "(screen mode)" marker: ${hasScreenModeMarker}`);

  // Test 3: Comparison
  console.log('\n=== RESULTS ===');
  const pageDiff = withPageCount - withoutPageCount;
  console.log(`Page count difference: ${pageDiff} (with @media print: ${withPageCount}, without: ${withoutPageCount})`);
  console.log(`Print mode marker found: ${hasPrintModeMarker}`);
  console.log(`Screen mode marker found (without @media print): ${hasScreenModeMarker}`);

  // Verification
  const pass1 = withPageCount === 3;
  const pass2 = hasPrintModeMarker === true;
  const pass3 = withPageCount !== withoutPageCount || hasPrintModeMarker !== hasScreenModeMarker;
  const allPass = pass1 && pass2 && pass3;

  console.log('\n=== VERIFICATION ===');
  console.log(`✓/✗ V1: PDF with @media print has 3 pages: ${pass1 ? 'PASS' : 'FAIL'}`);
  console.log(`✓/✗ V2: PDF contains "(print mode)" marker: ${pass2 ? 'PASS' : 'FAIL'}`);
  console.log(`✓/✗ V3: @media print affects output (diff from no @media print): ${pass3 ? 'PASS' : 'FAIL'}`);
  console.log(`\nOverall: ${allPass ? '✅ POC-01 PASSED' : '❌ POC-01 FAILED'}`);

  // Save PDFs for manual inspection
  const outDir = join(__dirname, 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(join(outDir, 'with-media-print.pdf'), pdfWithMediaPrint);
  fs.writeFileSync(join(outDir, 'without-media-print.pdf'), pdfWithoutMediaPrint);
  console.log(`\nPDFs saved to ${outDir} for manual inspection.`);

  app.quit();
  process.exit(allPass ? 0 : 1);
}

async function generatePdf(html) {
  const win = new BrowserWindow({
    width: 800,
    height: 1100,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  await new Promise((resolve) => {
    win.webContents.once('did-finish-load', resolve);
    setTimeout(resolve, 3000);
  });

  const pdfData = await win.webContents.printToPDF({
    pageSize: 'A4',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    printBackground: true,
    preferCSSPageSize: false,
  });

  win.destroy();
  return pdfData;
}

function countPdfPages(pdfBuffer) {
  const text = pdfBuffer.toString('latin1');
  const matches = text.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 0;
}

function stripMediaPrintBlock(html) {
  return html.replace(/@media\s+print\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g, '');
}

runTest().catch((err) => {
  console.error('POC-01 failed with error:', err);
  process.exit(1);
});
