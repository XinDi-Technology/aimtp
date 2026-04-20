# Electron 应用体积优化方案

## 📊 当前状况

- **安装包大小**: 100+ MB
- **安装后占用**: 500+ MB

---

## ✅ 已完成的优化（立即生效）

### 1. ASAR 打包 + 最大压缩
**文件**: `electron-builder.json`

```json
{
  "asar": true,
  "compression": "maximum"
}
```

**效果**: 
- 安装包减少 ~20-30%
- 安装后体积减少 ~30%
- 原理: 将所有文件打包成单个 asar 归档

---

### 2. Vite 构建优化
**文件**: `vite.config.ts`

```typescript
{
  minify: 'terser',  // 比 esbuild 更好的压缩率
  terserOptions: {
    compress: {
      drop_console: true,   // 移除 console.log
      drop_debugger: true,
    },
  },
  cssMinify: true,     // 启用 CSS 压缩
  sourcemap: false,    // 生产环境不需要 sourcemap
}
```

**效果**:
- JavaScript 减少 ~10-15%
- CSS 减少 ~20-30%
- 移除所有调试代码

---

### 3. 添加 Terser 依赖
**文件**: `package.json`

已添加: `"terser": "^5.46.0"`

---

## 💡 进一步优化建议（可选）

### 方案 B: 单架构打包（推荐 ⭐⭐⭐）

**问题**: 当前可能打包了多架构（x64 + arm64）

**解决方案**: 只打包 x64 架构

**修改**: `electron-builder.json`

```json
{
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]  // 只打包 x64
      }
    ]
  }
}
```

**预期效果**: 
- 安装包减少 ~40-50%
- 安装后减少 ~40-50%
- **这是最大的优化点！**

---

### 方案 C: 使用 portable 或 zip 格式

**NSIS 安装器**会解压所有文件，占用更多空间。

**替代方案**:

1. **Portable 版本** (Windows)
```json
{
  "win": {
    "target": ["portable"]
  }
}
```

2. **7z 压缩**
```json
{
  "win": {
    "target": ["7z"]
  }
}
```

**预期效果**:
- 安装包更小
- 用户可以选择不安装，直接运行

---

### 方案 D: 排除不必要的文件

**修改**: `electron-builder.json`

```json
{
  "files": [
    "dist/**/*",
    "src/fonts/**/*",
    "package.json",
    "!**/*.map",           // 排除 sourcemap
    "!**/*.d.ts",          // 排除 TypeScript 声明
    "!tests/**/*",         // 排除测试文件
    "!**/.DS_Store",       // 排除系统文件
    "!**/README.md",       // 排除文档
    "!**/LICENSE"          // 排除许可证（可选）
  ]
}
```

**预期效果**: 减少 5-10 MB

---

### 方案 E: 优化 node_modules

**检查未使用的依赖**:

```bash
# 安装分析工具
npm install --save-dev webpack-bundle-analyzer

# 分析打包结果
npm run build
npx webpack-bundle-analyzer dist/renderer/stats.html
```

**可能的优化**:
- 移除未使用的依赖
- 使用更轻量的替代库
- 懒加载大型库（MathJax, Mermaid）

---

### 方案 F: 字体优化（不删除，但优化）

**当前字体**: ~11.7 MB

**优化选项**:

1. **字体子集化** (保留 GWM Sans UI)
   - 工具: fonttools / font-subset
   - 只包含常用汉字 (~3500 个)
   - 预期: 每个字体从 3.6 MB → ~500 KB
   - 总节省: ~9 MB

2. **只保留必要字重**
   - 保留: Regular
   - 删除: Bold, Light (用 CSS font-weight 模拟)
   - 节省: ~7 MB

---

## 🎯 推荐执行顺序

### 第一阶段：立即执行（已完成 ✅）
1. ✅ ASAR 打包
2. ✅ Terser 压缩
3. ✅ CSS 压缩

### 第二阶段：高优先级（强烈推荐 ⭐⭐⭐）
4. **单架构打包** - 减少 40-50%
   ```json
   "arch": ["x64"]
   ```

5. **排除不必要文件** - 减少 5-10 MB
   ```json
   "files": [
     "!**/*.map",
     "!**/*.d.ts",
     "!tests/**/*"
   ]
   ```

### 第三阶段：中优先级（可选 ⭐⭐）
6. **字体子集化** - 减少 ~9 MB
7. **懒加载大型库** - 减少初始加载时间

### 第四阶段：低优先级（按需 ⭐）
8. 更换打包格式（portable/7z）
9. 深度优化 node_modules

---

## 📈 预期优化效果

| 优化项 | 安装包减少 | 安装后减少 | 难度 |
|--------|-----------|-----------|------|
| ASAR + 压缩 | 20-30% | 30% | ✅ 已完成 |
| Terser 压缩 | 5-10% | 5-10% | ✅ 已完成 |
| **单架构打包** | **40-50%** | **40-50%** | 🔥 简单 |
| 排除不必要文件 | 5-10 MB | 5-10 MB | 🔥 简单 |
| 字体子集化 | ~9 MB | ~9 MB | ⚠️ 中等 |
| 懒加载库 | 不明显 | 运行时减少 | ⚠️ 中等 |

**综合预期**:
- 安装包: 100 MB → **40-50 MB** (减少 50-60%)
- 安装后: 500 MB → **200-250 MB** (减少 50%)

---

## 🔧 实施步骤

### 1. 确认单架构打包

检查当前 `electron-builder.json`:

```json
{
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]  // ← 确保只有 x64
      }
    ]
  }
}
```

### 2. 添加文件排除规则

```json
{
  "files": [
    "dist/**/*",
    "src/fonts/**/*",
    "package.json",
    "!**/*.map",
    "!**/*.d.ts",
    "!tests/**/*",
    "!**/.DS_Store"
  ]
}
```

### 3. 重新构建

```bash
npm run build
npm run dist
```

### 4. 检查输出大小

```bash
# Windows PowerShell
Get-ChildItem release -Recurse | Measure-Object -Property Length -Sum

# 查看具体文件大小
Get-ChildItem release\*.exe | Select-Object Name, @{Name="SizeMB";Expression={[math]::Round($_.Length / 1MB, 2)}}
```

---

## 💡 额外建议

### 1. 使用 electron-updater 增量更新

如果应用需要频繁更新，使用增量更新可以减少用户下载量。

### 2. 提供多个安装包

- **完整版**: 包含所有功能
- **精简版**: 只包含核心功能（可选 MathJax、Mermaid）

### 3. 监控实际使用情况

使用 analytics 了解哪些功能最常用，针对性优化。

---

## 📝 总结

**最重要的优化**（按优先级）:

1. ⭐⭐⭐ **单架构打包** - 减少 40-50%
2. ⭐⭐⭐ **ASAR + 压缩** - 已完成，减少 20-30%
3. ⭐⭐ **排除不必要文件** - 减少 5-10 MB
4. ⭐ **字体优化** - 可选，减少 ~9 MB

**不建议的优化**:
- ❌ 删除 GWM Sans UI 字体（您已明确不使用）
- ❌ 过度优化导致功能缺失
- ❌ 影响用户体验的激进压缩

---

## 🚀 下一步行动

1. 确认 `electron-builder.json` 中 `arch` 设置为 `["x64"]`
2. 添加文件排除规则
3. 重新构建并测试
4. 对比优化前后的大小
5. 根据结果决定是否进行字体优化

