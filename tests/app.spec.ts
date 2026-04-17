import { test, expect } from '@playwright/test';

const BASE_TIMEOUT = 10000;

test.describe('AIMTP Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('header.toolbar', { timeout: BASE_TIMEOUT });
  });

  test.describe('Core UI Components', () => {
    test('should load the main page without errors', async ({ page }) => {
      const title = await page.title();
      expect(title).toBeTruthy();
    });

    test('should have toolbar component', async ({ page }) => {
      await expect(page.locator('header.toolbar')).toBeVisible();
    });

    test('should have editor panel', async ({ page }) => {
      await expect(page.locator('.editor-panel')).toBeVisible();
    });

    test('should have preview panel', async ({ page }) => {
      await expect(page.locator('.preview-panel')).toBeVisible();
    });

    test('should have settings panel', async ({ page }) => {
      await expect(page.locator('.settings-panel')).toBeVisible();
    });

    test('should have status bar with word and line count', async ({ page }) => {
      await expect(page.locator('.status-bar')).toBeVisible();
    });

    test('should have export PDF button', async ({ page }) => {
      await expect(page.locator('header.toolbar button').filter({ hasText: /(导出 PDF|Export PDF)/ })).toBeVisible();
    });
  });

  test.describe('Editor Functionality', () => {
    test.beforeEach(async ({ page }) => {
      await page.evaluate(() => localStorage.removeItem('aimtp-autosave'));
    });

    test('should edit markdown content and see preview', async ({ page }) => {
      const editor = page.locator('.editor-panel textarea');
      await editor.fill('# Test Heading\n\nThis is a test paragraph.');

      const preview = page.locator('.preview-panel');
      await expect(preview).toContainText('Test Heading');
      await expect(preview).toContainText('This is a test paragraph');
    });

    test('should toggle editor visibility', async ({ page }) => {
      const editor = page.locator('.editor-panel');
      await expect(editor).toBeVisible();

      const toolbarButtons = page.locator('.toolbar .btn');
      await toolbarButtons.nth(1).click();
      await expect(editor).toBeHidden();

      await toolbarButtons.nth(1).click();
      await expect(editor).toBeVisible();
    });

    test('should update word count when editing', async ({ page }) => {
      const editor = page.locator('.editor-panel textarea');
      await editor.fill('Hello World\nThis is a test');

      const statusBar = page.locator('.status-bar');
      await expect(statusBar).toContainText(/(字 数|word)/);
      await expect(statusBar).toContainText(/(行数|line)/);
    });

    test('should handle empty markdown', async ({ page }) => {
      const editor = page.locator('.editor-panel textarea');
      await editor.fill('');

      const statusBar = page.locator('.status-bar');
      await expect(statusBar).toContainText('字 数: 0');
    });
  });

  test.describe('Settings Panel', () => {
    test('should have page size selector', async ({ page }) => {
      const settingsPanel = page.locator('.settings-panel');
      await expect(settingsPanel).toContainText(/页面设置|Page Settings/);
      await expect(settingsPanel.locator('select').first()).toBeVisible();
    });

    test('should have font settings', async ({ page }) => {
      await expect(page.locator('.settings-panel')).toContainText(/字体设置|Font Settings/);
    });

    test('should have extension settings', async ({ page }) => {
      await expect(page.locator('.settings-panel')).toContainText(/(扩展功能|Extensions)/);
    });

    test('should have code highlight toggle', async ({ page }) => {
      const settingsPanel = page.locator('.settings-panel');
      const checkboxes = settingsPanel.locator('input[type="checkbox"]');
      await expect(checkboxes.first()).toBeVisible();
    });

    test('should have GitHub alerts toggle', async ({ page }) => {
      await expect(page.locator('.settings-panel')).toContainText(/(GitHub 风格警告框|githubAlerts)/);
    });

    test('should have cover settings', async ({ page }) => {
      await expect(page.locator('.settings-panel')).toContainText(/(封面设置|Cover Settings)/);
    });

    test('should have header footer settings', async ({ page }) => {
      await expect(page.locator('.settings-panel')).toContainText(/(页眉页脚|Header Footer)/);
    });

    test('should have page margins controls', async ({ page }) => {
      await expect(page.locator('.margin-controls')).toBeVisible();
    });

    test('should have save as template button', async ({ page }) => {
      await expect(page.locator('.settings-panel button').filter({ hasText: /(保存设置为模板|Save as Template)/ })).toBeVisible();
    });
  });

  test.describe('App Settings', () => {
    test('should have app settings section', async ({ page }) => {
      await expect(page.locator('.settings-panel')).toContainText(/应用设置|App Settings/);
    });

    test('should have auto save toggle', async ({ page }) => {
      await expect(page.locator('.settings-panel')).toContainText(/启用自动保存|Enable Auto Save/);
    });
  });

  test.describe('Template System', () => {
    test('should open template selection panel', async ({ page }) => {
      await page.locator('header.toolbar button').filter({ hasText: /(模板|Template)/ }).click();
      await expect(page.locator('.template-selection-panel')).toBeVisible();
    });

    test('should show preset templates in selection panel', async ({ page }) => {
      await page.locator('header.toolbar button').filter({ hasText: /(模板|Template)/ }).click();
      await expect(page.locator('.template-selection-panel')).toContainText(/(预设模板|Preset Templates)/);
    });

    test('should select blank template', async ({ page }) => {
      await page.locator('header.toolbar button').filter({ hasText: /(模板|Template)/ }).click();
      await page.locator('.template-card').first().locator('button').click();
      await expect(page.locator('.editor-panel textarea')).toBeVisible();
    });
  });

  test.describe('Internationalization', () => {
    test('should switch locale between zh and en', async ({ page }) => {
      const langToggle = page.locator('.lang-toggle');
      await langToggle.click();

      const langText = await langToggle.textContent();
      expect(langText).toMatch(/(EN|中文)/);
    });
  });

  test.describe('Preview Rendering', () => {
    test('should render GitHub Alerts in preview', async ({ page }) => {
      const editor = page.locator('.editor-panel textarea');
      await editor.fill(':::note\nThis is a note\n:::');

      await expect(page.locator('.preview-panel')).toContainText('This is a note');
    });

    test('should show A4 ruler in preview', async ({ page }) => {
      await expect(page.locator('.preview-panel .ruler-container')).toBeVisible();
    });
  });

  test.describe('Settings Persistence', () => {
    test('should persist settings after reload', async ({ page }) => {
      const settingsPanel = page.locator('.settings-panel');
      const pageSizeSelect = settingsPanel.locator('select').first();

      await pageSizeSelect.selectOption('A3');
      await page.reload();
      await page.waitForLoadState('networkidle');

      await expect(pageSizeSelect).toHaveValue('A3');
    });
  });

  test.describe('Edge Cases', () => {
    test.beforeEach(async ({ page }) => {
      await page.evaluate(() => localStorage.removeItem('aimtp-autosave'));
    });

    test('should handle special characters in markdown', async ({ page }) => {
      const editor = page.locator('.editor-panel textarea');
      await editor.fill('# Test & < > "characters"\n\n```js\nconst x = 1;\n```');

      const preview = page.locator('.preview-panel');
      await expect(preview).toContainText('Test');
    });

    test('should handle code block with language', async ({ page }) => {
      const editor = page.locator('.editor-panel textarea');
      await editor.fill('```javascript\nconst x = 1;\nconsole.log(x);\n```');

      const preview = page.locator('.preview-panel');
      await expect(preview).toContainText('const');
    });

    test('should handle multiline content', async ({ page }) => {
      const editor = page.locator('.editor-panel textarea');
      await editor.fill('Line 1\nLine 2\nLine 3\n\n## Section\n\nMore content here.');

      const statusBar = page.locator('.status-bar');
      await expect(statusBar).toContainText(/(行数|line)/);
      await expect(statusBar).toContainText(('行数: 6'));
    });
  });
});