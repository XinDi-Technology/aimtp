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
      await expect(page.locator('.preview-panel')).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.locator('.status-bar')).toBeVisible({ timeout: UI_TIMEOUT });
    });

    test('should have export PDF button', async ({ page }) => {
      await expect(page.locator('[data-testid="export-pdf-btn"]')).toBeVisible({ timeout: UI_TIMEOUT });
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

    test('should select report template and update preview', async ({ page }) => {
      await page.locator('[data-testid="template-btn"]').click({ timeout: UI_TIMEOUT });
      // 选择项目报告模板 (索引为1)
      const reportTemplateRow = page.locator('.template-row').nth(1);
      await reportTemplateRow.locator('.template-select-btn').click({ timeout: UI_TIMEOUT });
      
      // 等待模板选择面板关闭
      await page.waitForTimeout(500);
      await expect(page.locator('.template-selection-inline')).not.toBeVisible({ timeout: UI_TIMEOUT });
      
      // 验证预览内容已更新
      const preview = page.locator('.preview-panel');
      await expect(preview).toContainText(/(项目报告|Project Report)/, { timeout: UI_TIMEOUT });
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
    test('should show A4 page in preview', async ({ page }) => {
      // 新布局：检查 Word 风格的 A4 页面容器（可能有多个页面）
      const a4Pages = page.locator('.preview-panel .a4-page');
      await expect(a4Pages.first()).toBeVisible({ timeout: UI_TIMEOUT });
      // 验证至少有一个页面
      const count = await a4Pages.count();
      expect(count).toBeGreaterThanOrEqual(1);
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
});