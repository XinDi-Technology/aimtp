import { test, expect } from '@playwright/test';

const BASE_TIMEOUT = 30000;
const UI_TIMEOUT = 10000;

test.describe('Aimtp Application', () => {
  test.beforeEach(async ({ page }) => {
    // 只监听错误，减少日志输出
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // 只监听失败的网络请求
    const failedRequests: string[] = [];
    page.on('response', response => {
      const status = response.status();
      if (status >= 400) {
        failedRequests.push(`${status} ${response.url()}`);
      }
    });

    await page.goto('/', { timeout: BASE_TIMEOUT });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle').catch(() => {});
    
    // 只在有错误时输出日志
    if (consoleErrors.length > 0) {
      console.log('\n=== Console Errors ===');
      consoleErrors.forEach(err => console.log(err));
      console.log('=== End Console Errors ===\n');
    }
    
    if (failedRequests.length > 0) {
      console.log('\n=== Failed Network Requests ===');
      failedRequests.forEach(req => console.log(req));
      console.log('=== End Failed Requests ===\n');
    }
    
    // Wait for toolbar with extended timeout
    try {
      await page.waitForSelector('[data-testid="toolbar"]', { timeout: BASE_TIMEOUT });
    } catch (error) {
      console.log('\n⚠️  Toolbar not found. Page content length:', (await page.content()).length);
      if (consoleErrors.length > 0) {
        console.log('Console errors:', consoleErrors.slice(0, 5)); // 只显示前5个错误
      }
      throw error;
    }
    
    // Clear localStorage
    try {
      await page.evaluate(() => {
        if (typeof localStorage !== 'undefined') {
          localStorage.clear();
        }
      });
    } catch (e) {
      // Ignore localStorage errors
    }
  });

  test.describe('Core UI Components', () => {
    test('should load the main page without errors', async ({ page }) => {
      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title).toContain('Aimtp');
    });

    test('should have all core components visible', async ({ page }) => {
      await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.locator('[data-testid="editor-panel"]')).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.locator('.preview-panel')).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.locator('.status-bar')).toBeVisible({ timeout: UI_TIMEOUT });
    });

    test('should have export PDF button', async ({ page }) => {
      await expect(page.locator('[data-testid="export-pdf-btn"]')).toBeVisible({ timeout: UI_TIMEOUT });
    });
  });

  test.describe('Editor Functionality', () => {
    test.beforeEach(async ({ page }) => {
      try {
        await page.evaluate(() => localStorage.removeItem('aimtp-autosave'));
      } catch (e) {
        console.log('localStorage not available in this context');
      }
    });

    test('should edit markdown content and see preview', async ({ page }) => {
      const editor = page.locator('[data-testid="editor-textarea"]');
      await editor.fill('# Test Heading\n\nThis is a test paragraph.', { timeout: UI_TIMEOUT });

      const preview = page.locator('.preview-panel');
      await expect(preview).toContainText('Test Heading', { timeout: UI_TIMEOUT });
      await expect(preview).toContainText('This is a test paragraph', { timeout: UI_TIMEOUT });
    });

    test('should toggle editor visibility', async ({ page }) => {
      const editor = page.locator('[data-testid="editor-panel"]');
      await expect(editor).toBeVisible({ timeout: UI_TIMEOUT });

      const toggleBtn = page.locator('[data-testid="toggle-editor-btn"]');
      await toggleBtn.click({ timeout: UI_TIMEOUT });
      await expect(editor).toBeHidden({ timeout: UI_TIMEOUT });

      await toggleBtn.click({ timeout: UI_TIMEOUT });
      await expect(editor).toBeVisible({ timeout: UI_TIMEOUT });
    });

    test('should update word count when editing', async ({ page }) => {
      const editor = page.locator('[data-testid="editor-textarea"]');
      await editor.fill('Hello World\nThis is a test', { timeout: UI_TIMEOUT });

      const statusBar = page.locator('.status-bar');
      await expect(statusBar).toContainText(/(字 数|word)/, { timeout: UI_TIMEOUT });
      await expect(statusBar).toContainText(/(行数|line)/, { timeout: UI_TIMEOUT });
    });

    test('should handle empty markdown', async ({ page }) => {
      const editor = page.locator('[data-testid="editor-textarea"]');
      await editor.fill('', { timeout: UI_TIMEOUT });

      const statusBar = page.locator('.status-bar');
      await expect(statusBar).toContainText('字 数: 0', { timeout: UI_TIMEOUT });
    });
  });

  test.describe('Settings Panel', () => {
    test('should have page size selector', async ({ page }) => {
      const settingsPanel = page.locator('[data-testid="settings-panel"]');
      await expect(settingsPanel).toContainText(/页面设置|Page Settings/, { timeout: UI_TIMEOUT });
      await expect(page.locator('[data-testid="page-size-select"]')).toBeVisible({ timeout: UI_TIMEOUT });
    });

    test('should have font settings', async ({ page }) => {
      await expect(page.locator('[data-testid="settings-panel"]')).toContainText(/字体设置|Font Settings/, { timeout: UI_TIMEOUT });
    });

    test('should have extension settings', async ({ page }) => {
      await expect(page.locator('[data-testid="settings-panel"]')).toContainText(/(扩展功能|Extensions)/, { timeout: UI_TIMEOUT });
    });

    test('should have code highlight toggle', async ({ page }) => {
      const settingsPanel = page.locator('[data-testid="settings-panel"]');
      const checkboxes = settingsPanel.locator('input[type="checkbox"]');
      await expect(checkboxes.first()).toBeVisible({ timeout: UI_TIMEOUT });
    });

    test('should have GitHub alerts toggle', async ({ page }) => {
      await expect(page.locator('[data-testid="settings-panel"]')).toContainText(/(GitHub 风格警告框|githubAlerts)/, { timeout: UI_TIMEOUT });
    });

    test('should have cover settings', async ({ page }) => {
      await expect(page.locator('[data-testid="settings-panel"]')).toContainText(/(封面设置|Cover Settings)/, { timeout: UI_TIMEOUT });
    });

    test('should have header footer settings', async ({ page }) => {
      await expect(page.locator('[data-testid="settings-panel"]')).toContainText(/(页眉页脚|Header Footer)/, { timeout: UI_TIMEOUT });
    });

    test('should have page margins controls', async ({ page }) => {
      await expect(page.locator('.margin-controls-vertical')).toBeVisible({ timeout: UI_TIMEOUT });
    });

    test('should have save as template button', async ({ page }) => {
      await expect(page.locator('[data-testid="settings-panel"] button').filter({ hasText: /(保存设置为模板|Save as Template)/ })).toBeVisible({ timeout: UI_TIMEOUT });
    });
  });

  test.describe('App Settings', () => {
    test('should have app settings section', async ({ page }) => {
      await expect(page.locator('[data-testid="settings-panel"]')).toContainText(/应用设置|App Settings/, { timeout: UI_TIMEOUT });
    });

    test('should have auto save toggle', async ({ page }) => {
      await expect(page.locator('[data-testid="settings-panel"]')).toContainText(/启用自动保存|Enable Auto Save/, { timeout: UI_TIMEOUT });
    });
  });

  test.describe('Template System', () => {
    test('should open template selection panel', async ({ page }) => {
      await page.locator('[data-testid="template-btn"]').click({ timeout: UI_TIMEOUT });
      await expect(page.locator('.template-selection-inline')).toBeVisible({ timeout: UI_TIMEOUT });
    });

    test('should show preset templates in selection panel', async ({ page }) => {
      await page.locator('[data-testid="template-btn"]').click({ timeout: UI_TIMEOUT });
      await expect(page.locator('.template-selection-inline')).toContainText(/(预设模板|Preset Templates)/, { timeout: UI_TIMEOUT });
    });

    test('should select blank template', async ({ page }) => {
      await page.locator('[data-testid="template-btn"]').click({ timeout: UI_TIMEOUT });
      await page.locator('.template-card').first().locator('button').click({ timeout: UI_TIMEOUT });
      await expect(page.locator('[data-testid="editor-textarea"]')).toBeVisible({ timeout: UI_TIMEOUT });
    });
  });

  test.describe('Internationalization', () => {
    test('should switch locale between zh and en', async ({ page }) => {
      const langToggle = page.locator('[data-testid="lang-toggle-btn"]');
      
      await expect(langToggle).toHaveText('中文', { timeout: UI_TIMEOUT });
      await expect(page.locator('[data-testid="import-file-btn"]')).toContainText('导入文件', { timeout: UI_TIMEOUT });
      
      await langToggle.click({ timeout: UI_TIMEOUT });
      await expect(langToggle).toHaveText('EN', { timeout: UI_TIMEOUT });
      await expect(page.locator('[data-testid="import-file-btn"]')).toContainText('Import', { timeout: UI_TIMEOUT });
      
      await langToggle.click({ timeout: UI_TIMEOUT });
      await expect(langToggle).toHaveText('中文', { timeout: UI_TIMEOUT });
      await expect(page.locator('[data-testid="import-file-btn"]')).toContainText('导入文件', { timeout: UI_TIMEOUT });
    });
  });

  test.describe('Preview Rendering', () => {
    test('should render GitHub Alerts in preview', async ({ page }) => {
      const editor = page.locator('[data-testid="editor-textarea"]');
      await editor.fill(':::note\nThis is a note\n:::', { timeout: UI_TIMEOUT });

      await expect(page.locator('.preview-panel')).toContainText('This is a note', { timeout: UI_TIMEOUT });
    });

    test('should show A4 ruler in preview', async ({ page }) => {
      await expect(page.locator('.preview-panel .ruler-container')).toBeVisible({ timeout: UI_TIMEOUT });
    });
  });

  test.describe('Settings Persistence', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/', { timeout: BASE_TIMEOUT });
      await page.waitForSelector('[data-testid="toolbar"]', { timeout: BASE_TIMEOUT });
      try {
        await page.evaluate(() => localStorage.clear());
      } catch (e) {
        console.log('localStorage not available in this context');
      }
    });

    test('should persist settings after reload', async ({ page }) => {
      const pageSizeSelect = page.locator('[data-testid="page-size-select"]');

      await pageSizeSelect.selectOption('A3', { timeout: UI_TIMEOUT });
      await page.reload();
      await page.waitForSelector('[data-testid="toolbar"]', { timeout: BASE_TIMEOUT });

      await expect(pageSizeSelect).toHaveValue('A3', { timeout: UI_TIMEOUT });
    });
  });

  test.describe('Edge Cases', () => {
    test.beforeEach(async ({ page }) => {
      try {
        await page.evaluate(() => localStorage.clear());
      } catch (e) {
        console.log('localStorage not available in this context');
      }
    });

    test('should handle special characters in markdown', async ({ page }) => {
      const editor = page.locator('[data-testid="editor-textarea"]');
      await editor.fill('# Test & < > "characters"\n\n```js\nconst x = 1;\n```', { timeout: UI_TIMEOUT });

      const preview = page.locator('.preview-panel');
      await expect(preview).toContainText('Test', { timeout: UI_TIMEOUT });
    });

    test('should handle code block with language', async ({ page }) => {
      const editor = page.locator('[data-testid="editor-textarea"]');
      await editor.fill('```javascript\nconst x = 1;\nconsole.log(x);\n```', { timeout: UI_TIMEOUT });

      const preview = page.locator('.preview-panel');
      await expect(preview).toContainText('const', { timeout: UI_TIMEOUT });
    });

    test('should handle multiline content', async ({ page }) => {
      const editor = page.locator('[data-testid="editor-textarea"]');
      await editor.fill('Line 1\nLine 2\nLine 3\n\n## Section\n\nMore content here.', { timeout: UI_TIMEOUT });

      const statusBar = page.locator('.status-bar');
      await expect(statusBar).toContainText(/(行数|line)/, { timeout: UI_TIMEOUT });
    });
  });
});