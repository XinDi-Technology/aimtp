# Aimtp

[![GitHub release](https://img.shields.io/github/v/release/XinDi-Technology/aimtp?include_prereleases)](https://github.com/XinDi-Technology/aimtp/releases)
[![Build Status](https://img.shields.io/github/actions/workflow/status/XinDi-Technology/aimtp/build.yml?branch=main)](https://github.com/XinDi-Technology/aimtp/actions/workflows/build.yml)
[![Node Version](https://img.shields.io/badge/node-%3E%3D24.0.0-brightgreen)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)](https://github.com/XinDi-Technology/aimtp/releases)
[![License](https://img.shields.io/github/license/XinDi-Technology/aimtp)](./LICENSE)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](https://www.contributor-covenant.org/)

专注合规的 Markdown 转 PDF 桌面应用

Compliance-first Markdown to PDF desktop application

---

## 核心特性

-   **完全本地运行**：无需网络环境。
-   **免费可商用字体**：内置 GWM Sans UI（中文）、JetBrains Mono 与 Monaspace Argon Frozen（代码），全部免费商用，无版权风险
-   **预览即所得**：所见即所得，预览效果与导出 PDF 完全一致
-   **真纸张尺寸预览**：预览区域按实际页面宽高比渲染，你看到的每一页都和打印出的纸张大小一样
-   **导出PDF兼容性高**：使用PDF v1.4格式进行导出。
## 安装使用

从 [Releases](https://github.com/XinDi-Technology/aimtp/releases) 页面下载对应平台的安装包：

-   **Windows**：`.exe`（向导式安装）

Windows 安装程序为向导式（NSIS）：

1.  启动后先选择界面语言（中文 / English）；
2.  默认安装到当前用户目录，**不需要管理员权限**；也可为所有用户安装并自选安装路径；
3.  可选择是否创建桌面快捷方式与开始菜单快捷方式；
4.  安装完成后可直接启动。

## 支持的排版设置

### 页面

| 设置 | 可选值 |
| :-: | :-: |
| 页面尺寸 | A4 / A3 |
| 页面方向 | 纵向 / 横向 |
| 页边距 | 上 / 下 / 左 / 右 |
| DPI | 可自定义 |

### 字体与排版

| 设置 | 可选值 |
| :-: | :-: |
| 正文字体 | GWM Sans UI |
| 代码字体 | JetBrains Mono / Monaspace Argon Frozen |
| 基础字号 | 可自定义（默认 18） |
| 行高 | 可自定义（默认 2） |
| 段落间距 | 可自定义（默认 0.5） |

### 内容特性

-   代码高亮（GitHub / Monokai / Dracula 主题）
-   显示代码行号
-   GitHub 风格警告框
-   按 H1 / H2 标题自动分页
-   下标 / 上标
-   封面
-   脚注（当前页底部 / 文档底部）
-   高亮标记
-   下划线
-   待办事项
-   Mermaid 图表 （todo）
-   MathJax 数学公式 （todo）

### 页眉页脚

| 设置 | 可选值 |
| :-: | :-: |
| 页眉字体 | GWM Sans UI |
| 页眉对齐 | 左对齐 / 居中 / 右对齐 |
| 页眉内容 | 标题 / 作者 / 日期 |
| 页脚字体 | GWM Sans UI |
| 页脚对齐 | 左对齐 / 居中 / 右对齐 |
| 页脚内容 | 页码 / 第 X 页 / 共 X 页 |

## 预设模板

内置唯一的预设模板「中文技术文档」：正文包含完整的设置说明表与 Markdown 排版示例，
并携带一套默认排版设置（A4 纵向、页边距上 20 / 下 20 / 左 24 / 右 24 mm、基础字号 18px、
行高 2、段落间距 0.5em、目标 DPI 93）。选择该模板即应用这套设置，
这套设置同时也是应用首次启动时的默认值。

## 数据与卸载

自定义模板以 JSON 文件的形式保存在应用数据目录下，每个模板一个文件：

| 平台 | 目录 |
| :-: | :-: |
| Windows | `%APPDATA%\Aimtp\templates` |
| macOS | `~/Library/Application Support/Aimtp/templates` |
| Linux | `~/.config/Aimtp/templates` |

-   可在「设置」面板底部直接打开该目录，方便备份、拷贝或纳入版本管理。
-   **卸载应用不会删除该目录**，重新安装后模板仍然保留。
-   如需彻底清除，可使用设置面板中的「清除所有个人数据」，该操作会删除全部自定义模板并重置界面设置，不可撤销。

## 字体说明

本项目使用以下免费可商用字体，确保生成的 PDF 文档无字体版权纠纷：

| 字体 | 用途 | 标准 | 许可 |
| :-: | :-: | :-: | :-: |
| [GWM Sans UI](https://www.gwm.com.cn/gwmsans/fontdownload.html) | 中文正文 / 页眉页脚 | GB18030-2022 L2 | 免费商用 |
| [JetBrains Mono](https://www.jetbrains.com/lp/mono/) | 代码 |  | [OFL 1.1](https://github.com/JetBrains/JetBrainsMono?tab=OFL-1.1-1-ov-file) |
| [Monaspace Argon Frozen](https://monaspace.githubnext.com/) | 代码 |  | [OFL 1.1](https://github.com/githubnext/monaspace?tab=OFL-1.1-1-ov-file) |

## 风险警告

1.  本项目由 AI 辅助编程
2.  本项目目前为个人爱好性质软件
3.  本项目目前未收到赞助
4.  本项目目前未有其他贡献者
5.  本项目目前专注于核心功能的完善
6.  本项目目前没有其他使用者汇报使用情况

## License

[MIT](./LICENSE)