/**
 * ESLint flat config（ESLint 10）
 *
 * 由旧版 .eslintrc.json 迁移而来，规则语义保持一致：
 * - eslint:recommended        → @eslint/js configs.recommended
 * - plugin:@typescript-eslint → typescript-eslint 聚合包 configs.recommended
 * - plugin:react/recommended  → @eslint-react/eslint-plugin configs['recommended-typescript']
 * - plugin:react-hooks        → eslint-plugin-react-hooks configs['recommended-latest']
 * - env: browser + node       → globals.browser + globals.node
 */
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import eslintReact from '@eslint-react/eslint-plugin';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // 全局忽略：构建产物、测试报告、第三方 vendor 脚本、构建脚本
  //（scripts/*.mjs 与 vendor 历史上不在 --ext ts,tsx 检查范围内，保持一致）
  {
    ignores: [
      'dist/**',
      'release/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'node_modules/**',
      'src/renderer/public/vendor/**',
      'scripts/**',
    ],
  },

  // 等价于旧配置的 env: browser + node（全局生效）
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintReact.configs['recommended-typescript'],
  reactHooks.configs['recommended-latest'],

  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // ── 由旧 .eslintrc.json 平移的自定义规则 ──
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // 集中式 logger：职责即转发 console，豁免 no-console
  {
    files: ['src/main/logger.ts', 'src/renderer/utils/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // 测试用例中的 console 输出用于 CI 诊断，豁免 no-console
  {
    files: ['tests/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // 类型声明文件：描述无类型第三方模块时 any 是惯例
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
