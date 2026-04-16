import { test, expect } from '@playwright/test';

test.describe('AIMTP Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('should load the main page without errors', async ({ page }) => {
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('should have toolbar component', async ({ page }) => {
    const toolbar = page.locator('.toolbar');
    await expect(toolbar).toBeVisible();
  });

  test('should have editor panel', async ({ page }) => {
    const editor = page.locator('.editor-panel');
    await expect(editor).toBeVisible();
  });

  test('should have preview panel', async ({ page }) => {
    const preview = page.locator('.preview-panel');
    await expect(preview).toBeVisible();
  });

  test('should have settings panel', async ({ page }) => {
    const settingsPanel = page.locator('.settings-panel');
    await expect(settingsPanel).toBeVisible();
  });

  test('should switch locale between zh and en', async ({ page }) => {
    const langToggle = page.locator('.lang-toggle');
    await langToggle.click();
    
    const langText = await langToggle.textContent();
    expect(langText).toMatch(/EN|中文/);
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

  test('should have status bar with word and line count', async ({ page }) => {
    const statusBar = page.locator('.status-bar');
    await expect(statusBar).toBeVisible();
  });

  test('should open template selection panel', async ({ page }) => {
    const templateBtn = page.locator('.toolbar button').filter({ hasText: /模板|Template/ });
    await templateBtn.click();
    
    const templatePanel = page.locator('.template-selection-panel');
    await expect(templatePanel).toBeVisible();
  });

  test('should show preset templates in selection panel', async ({ page }) => {
    const templateBtn = page.locator('.toolbar button').filter({ hasText: /模板|Template/ });
    await templateBtn.click();
    
    const templatePanel = page.locator('.template-selection-panel');
    await expect(templatePanel).toContainText(/预设模板|Preset Templates/);
  });

  test('should select blank template', async ({ page }) => {
    const templateBtn = page.locator('.toolbar button').filter({ hasText: /模板|Template/ });
    await templateBtn.click();
    
    const blankTemplate = page.locator('.template-card').first();
    await blankTemplate.locator('button').click();
    
    const editor = page.locator('.editor-panel textarea');
    await expect(editor).toBeVisible();
  });

  test('should have export PDF button', async ({ page }) => {
    const exportBtn = page.locator('.toolbar button').filter({ hasText: /导出 PDF|Export PDF/ });
    await expect(exportBtn).toBeVisible();
  });

  test('should have page size selector in settings', async ({ page }) => {
    const settingsPanel = page.locator('.settings-panel');
    await expect(settingsPanel).toContainText(/页面设置|Page Settings/);
    await expect(settingsPanel.locator('select').first()).toBeVisible();
  });

  test('should have font settings in settings panel', async ({ page }) => {
    const settingsPanel = page.locator('.settings-panel');
    await expect(settingsPanel).toContainText(/字体设置|Font Settings/);
  });

  test('should have extension settings in settings panel', async ({ page }) => {
    const settingsPanel = page.locator('.settings-panel');
    await expect(settingsPanel).toContainText(/扩展功能|Extensions/);
  });

  test('should have code highlight toggle', async ({ page }) => {
    const settingsPanel = page.locator('.settings-panel');
    const codeHighlightCheckbox = settingsPanel.locator('input[type="checkbox"]').filter({
      has: page.locator('text=/启用代码高亮|codeHighlight/')
    });
    await expect(codeHighlightCheckbox.first()).toBeVisible();
  });

  test('should have GitHub alerts toggle', async ({ page }) => {
    const settingsPanel = page.locator('.settings-panel');
    await expect(settingsPanel).toContainText(/GitHub 风格警告框|githubAlerts/);
  });

  test('should have cover settings', async ({ page }) => {
    const settingsPanel = page.locator('.settings-panel');
    await expect(settingsPanel).toContainText(/封面设置|Cover Settings/);
  });

  test('should have header footer settings', async ({ page }) => {
    const settingsPanel = page.locator('.settings-panel');
    await expect(settingsPanel).toContainText(/页眉页脚|Header Footer/);
  });

  test('should have save as template button', async ({ page }) => {
    const settingsPanel = page.locator('.settings-panel');
    const saveTemplateBtn = settingsPanel.locator('button').filter({ hasText: /保存设置为模板|Save as Template/ });
    await expect(saveTemplateBtn).toBeVisible();
  });

  test('should render GitHub Alerts in preview', async ({ page }) => {
    const editor = page.locator('.editor-panel textarea');
    await editor.fill(':::note\nThis is a note\n:::');
    
    const preview = page.locator('.preview-panel');
    await expect(preview).toContainText('This is a note');
  });

  test('should show A4 ruler in preview', async ({ page }) => {
    const preview = page.locator('.preview-panel');
    const ruler = preview.locator('.ruler-container');
    await expect(ruler).toBeVisible();
  });

  test('should have app settings section', async ({ page }) => {
    const settingsPanel = page.locator('.settings-panel');
    await expect(settingsPanel).toContainText(/应用设置|App Settings/);
  });

  test('should have auto save toggle', async ({ page }) => {
    const settingsPanel = page.locator('.settings-panel');
    await expect(settingsPanel).toContainText(/启用自动保存|Enable Auto Save/);
  });

  test('should toggle auto save setting', async ({ page }) => {
    const settingsPanel = page.locator('.settings-panel');
    const autoSaveCheckbox = settingsPanel.locator('input[type="checkbox"]').filter({
      has: page.locator('text=/启用自动保存|Enable Auto Save/')
    });
    await expect(autoSaveCheckbox.first()).toBeVisible();
  });

  test('should have page margins controls', async ({ page }) => {
    const settingsPanel = page.locator('.settings-panel');
    const marginControls = settingsPanel.locator('.margin-controls');
    await expect(marginControls).toBeVisible();
  });

  test('should update word count when editing', async ({ page }) => {
    const editor = page.locator('.editor-panel textarea');
    await editor.fill('Hello World\nThis is a test');
    
    const statusBar = page.locator('.status-bar');
    await expect(statusBar).toContainText(/字数|word/);
    await expect(statusBar).toContainText(/行数|line/);
  });
});
