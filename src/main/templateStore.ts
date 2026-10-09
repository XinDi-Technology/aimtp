import { app } from 'electron';
import { join } from 'path';
import * as fs from 'fs';
import { logger } from './logger';
import { t } from '../shared/i18n';

/**
 * 自定义模板的持久化：每个模板一个 JSON 文件，放在 userData/templates 下。
 *
 * 之所以从 localStorage 迁到这里：
 * - localStorage 有容量上限，模板多了会写入失败；
 * - 落在磁盘上用户才能备份、拷贝、用版本管理工具管理；
 * - 目录位于 userData，安装程序的卸载流程不会删除它（见 electron-builder 的
 *   deleteAppDataOnUninstall: false），重装后模板仍在。
 *
 * 注意：这里只做「记录」的读写与基本字段校验，settings 的具体结构由渲染层的
 * validateCustomTemplates 负责，主进程不感知其内容。
 */

const TEMPLATES_DIR_NAME = 'templates';
const TEMPLATE_SUFFIX = '.json';
const SCHEMA_VERSION = 1;

/** 模板 id 直接用作文件名，必须限制字符集，防止路径穿越 */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export interface TemplateRecord {
  id: string;
  name: string;
  settings: unknown;
  createdAt: number;
}

export interface TemplateFile {
  version: number;
  template: TemplateRecord;
}

const isValidId = (id: unknown): id is string =>
  typeof id === 'string' && ID_PATTERN.test(id);

/** 模板目录：Windows 下形如 %APPDATA%\Aimtp\templates */
export function getTemplatesDir(): string {
  return join(app.getPath('userData'), TEMPLATES_DIR_NAME);
}

export function ensureTemplatesDir(): string {
  const dir = getTemplatesDir();
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (error) {
    logger.error('Failed to create templates directory:', dir, error);
  }
  return dir;
}

const templatePath = (dir: string, id: string): string => join(dir, `${id}${TEMPLATE_SUFFIX}`);

export function listTemplates(): TemplateRecord[] {
  const dir = ensureTemplatesDir();

  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch (error) {
    logger.error('Failed to read templates directory:', dir, error);
    return [];
  }

  const templates: TemplateRecord[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(TEMPLATE_SUFFIX)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(join(dir, entry), 'utf8')) as TemplateFile;
      const record = parsed?.template;
      if (!isValidId(record?.id)) {
        logger.warn('Skipping template file with invalid id:', entry);
        continue;
      }
      if (typeof record.name !== 'string' || record.name.trim() === '') {
        logger.warn('Skipping template file with invalid name:', entry);
        continue;
      }
      templates.push({
        id: record.id,
        name: record.name,
        settings: record.settings ?? {},
        createdAt: Number.isFinite(record.createdAt) ? record.createdAt : 0,
      });
    } catch (error) {
      logger.error('Failed to read template file:', entry, error);
    }
  }

  templates.sort((a, b) => a.createdAt - b.createdAt);
  return templates;
}

/**
 * 写入模板。先写 .tmp 再 rename，避免写入中途崩溃留下半截 JSON。
 */
export function saveTemplate(record: TemplateRecord): void {
  if (!isValidId(record?.id)) {
    throw new Error(t('template-invalid-id'));
  }
  if (typeof record.name !== 'string' || record.name.trim() === '') {
    throw new Error(t('template-invalid-name'));
  }

  const dir = ensureTemplatesDir();
  const target = templatePath(dir, record.id);
  const tmp = `${target}.tmp`;
  const payload: TemplateFile = { version: SCHEMA_VERSION, template: record };

  try {
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tmp, target);
  } catch (error) {
    logger.error('Failed to save template:', record.id, error);
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch { /* 临时文件清理失败可忽略 */ }
    throw new Error(t('template-write-error'), { cause: error });
  }
}

export function removeTemplate(id: string): void {
  if (!isValidId(id)) {
    throw new Error(t('template-invalid-id'));
  }
  const target = templatePath(ensureTemplatesDir(), id);
  try {
    if (fs.existsSync(target)) fs.unlinkSync(target);
  } catch (error) {
    logger.error('Failed to remove template:', id, error);
    throw new Error(t('template-write-error'), { cause: error });
  }
}

/** 清空全部自定义模板文件（「清除所有个人数据」用） */
export function clearAllTemplates(): void {
  const dir = ensureTemplatesDir();
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch (error) {
    logger.error('Failed to read templates directory:', dir, error);
    return;
  }
  for (const entry of entries) {
    if (!entry.endsWith(TEMPLATE_SUFFIX) && !entry.endsWith(`${TEMPLATE_SUFFIX}.tmp`)) continue;
    try {
      fs.unlinkSync(join(dir, entry));
    } catch (error) {
      logger.error('Failed to remove template file:', entry, error);
    }
  }
}
