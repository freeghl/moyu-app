# 🛠️ 摸鱼工具箱 (Moyu Toolbox)

> 基于 Electron + Vue 3 + TypeScript + Tailwind CSS 构建的现代化轻量级桌面端开发者工具箱。

[![Electron](https://img.shields.io/badge/Electron-33.x-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5.x-4FC08D?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## ✨ 核心特性

- ⚡ **现代前沿技术栈**：采用 Electron 33、Vue 3.5 (`<script setup>`)、Vite 6、Tailwind CSS v4 与 TypeScript，构建快速、轻量且流畅。
- 🧩 **模块化插件式架构**：工具间高内聚、低耦合。各工具只需在专属目录下配置 `manifest.ts` 与 `index.vue`，系统基于 `import.meta.glob` 自动发现并注册。
- 📑 **多标签工作区 (Tabs)**：支持同时开启多个工具并以 Tab 标签页模式无缝切换与管理。
- 🔍 **全局快速启动指令板 (Command Palette)**：支持全局快捷键 `Ctrl + K` / `Cmd + K` 快速唤起搜索框，工具分类、名称、拼音与关键词即搜即达。
- 🎨 **极简深色桌面 UI**：无边框自定义标题栏、现代化状态栏及侧边分类导航，符合开发者日常使用审美。
- 🗂 **全方位分类覆盖**：预设开发工具 (`dev`)、网络工具 (`network`)、图像处理 (`image`)、文件操作 (`file`)、加解密/编解码 (`crypto`) 及 AI 效率工具 (`ai`) 分类。

---

## 📁 目录规范

项目遵循严格的进程隔离与高内聚目录规范：

```text
src/
├── main/              # Electron 主进程 (窗口管理、IPC通道、系统底层能力)
│   ├── ipc/           # IPC 接口统一注册
│   └── services/      # 核心系统服务 (窗口、配置等)
├── preload/           # Preload 预加载层 (上下文桥接 ContextBridge)
├── renderer/src/      # 前端渲染层 (Vue 3)
│   ├── assets/        # 静态资源与 Tailwind 全局样式
│   ├── components/    # 顶部栏、侧边栏、Tab栏、搜索面板等公共框架组件
│   ├── layouts/       # 基础应用布局
│   ├── registry/      # 工具动态自动注册与发现引擎
│   ├── stores/        # Pinia 状态管理 (导航、Tab、收藏等)
│   ├── views/         # 基础与主页视图
│   └── tools/         # 独立工具目录 (分类存放)
│       └── [category]/[tool-name]/
│           ├── manifest.ts # 工具元信息清单
│           └── index.vue   # 工具独立主页面
└── shared/            # 主进程与渲染进程共享类型定义
```

---

## ⌨️ 快捷键

| 快捷键 | 功能 | 说明 |
| :--- | :--- | :--- |
| `Ctrl + K` / `Cmd + K` | **唤起命令搜索面板** | 全局快速检索并直接打开目标工具 |
| `Ctrl + W` / `Cmd + W` | **关闭当前标签页** | 快速关闭当前激活中的工具页 |

---

## 🚀 快速上手

### 环境准备

- [Node.js](https://nodejs.org/) (建议 `>= 18.0.0`)
- [pnpm](https://pnpm.io/) (建议 `>= 8.0.0`)

### 安装依赖

```bash
pnpm install
```

### 开发环境运行

```bash
pnpm dev
```

### 构建与打包

```bash
# 执行类型检查
pnpm type-check

# 构建安装包
pnpm build

# 预览构建产物
pnpm preview
```

---

## 🛠️ 新增独立工具指南

在项目中扩展新工具非常简单，只需两步：

### 1. 在 `src/renderer/src/tools/` 对应分类下创建工具目录

例如新增一个 JSON 格式化工具，路径为 `src/renderer/src/tools/dev/json-formatter/`：

```text
src/renderer/src/tools/dev/json-formatter/
├── index.vue       # 工具主界面
└── manifest.ts     # 工具声明配置
```

### 2. 编写 `manifest.ts`

```typescript
import type { ToolManifest } from '@shared/types'

export const manifest: ToolManifest = {
  id: 'json-formatter',
  name: 'JSON 格式化',
  description: '快速格式化、验证、美化与压缩 JSON 数据',
  icon: '⚡',
  category: 'dev', // 可选: dev | network | image | file | crypto | ai
  keywords: ['json', 'format', 'lint', '解析'],
  component: () => import('./index.vue')
}

export default manifest
```

系统会自动扫描该文件并将其注册至侧边栏、分类面板与全局搜索列表中，无需手动在全局路由或配置文件中导入！

---

## 📄 开源许可

本项目基于 [MIT](LICENSE) 许可证开源。
