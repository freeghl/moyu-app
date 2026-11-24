# 🛠️ DevBox 开发工具箱

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
- 📑 **多标签工作区 (Tabs)**：支持同时开启多个工具并以 Tab 标签页模式无缝切换，支持拖拽排序、右键菜单（关闭其他 / 关闭全部）与关闭后恢复。
- 🔍 **全局快速启动指令板 (Command Palette)**：支持全局快捷键 `Ctrl + K` / `Cmd + K` 快速唤起搜索框，按相关性排序并优先展示最近使用的工具。
- ⌨️ **快速隐藏与托盘常驻**：`Ctrl + Shift + H` 一键隐藏 / 恢复窗口，`Ctrl + Shift + K` 在任意程序里唤出窗口并打开命令面板；关闭窗口时可选择收进托盘。
- 💾 **状态持久化**：标签页、当前分类、侧边栏折叠、收藏、最近使用、各工具内的数据以及窗口尺寸位置都会自动保存，重启后回到上次的现场。
- 🎨 **极简深色桌面 UI**：无边框自定义标题栏、现代化状态栏及侧边分类导航，符合开发者日常使用审美。
- 🗂 **分类覆盖**：开发工具 (`dev`)、网络工具 (`network`)、图片工具 (`image`)、文件工具 (`file`)、加密工具 (`crypto`) 与 AI 工具 (`ai`) 均已有可用工具。

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
│   ├── stores/        # Pinia 状态管理 (导航、Tab、偏好等)
│   ├── utils/         # 公共函数（工具状态持久化等）
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
| `Ctrl + Shift + T` | **恢复关闭的标签页** | 误关时可以找回最近 10 个 |
| `Ctrl + Tab` / `Ctrl + Shift + Tab` | **切换标签页** | 在已打开的工具间循环切换 |
| `Ctrl + Shift + H` | **快速隐藏（全局）** | 一键隐藏窗口，再按一次恢复 |
| `Ctrl + Shift + K` | **全局唤起（全局）** | 在任何程序里唤出窗口并打开命令面板 |
| `Ctrl + Enter` | **钉住预览** | 文档速查：把悬停预览固定住持续操作 |
| `Esc` | **关闭预览 / 退出全屏** | 预览打开时优先关闭预览 |

> 快速隐藏与全局唤起可以在「系统设置」里改成任意组合键，也可以直接清空以停用。

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

工具如果需要保存自己的状态（例如输入内容、当前选中项），可以这样接入：

```typescript
import { useToolState } from '../../../utils/useToolState'

const state = useToolState('json-formatter', { input: '', indent: 2 })
// state.input / state.indent 的改动会自动落盘，重启后恢复
```

---

## 💾 数据存放位置

| 文件 | 内容 |
| :--- | :--- |
| `<userData>/preferences.json` | 设置、窗口尺寸位置、标签会话、收藏、最近使用、各工具状态 |
| `<userData>/sites.json` | 文档速查的自定义站点列表 |

`userData` 目录可以在「系统设置 → 数据与版本」里直接打开。文件损坏时会自动备份为 `.broken-<时间戳>.json` 并回退默认值，不会让应用卡在报错状态。

---

## 📄 开源许可

本项目基于 [MIT](LICENSE) 许可证开源。
