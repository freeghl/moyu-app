# 🐟 摸鱼神器 (Moyu App)

> 伪装成 Visual Studio Code 的多站点浏览器

[![Electron](https://img.shields.io/badge/Electron-33.x-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5.x-4FC08D?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## ✨ 核心特性

- 🎭 **VS Code 伪装**：默认进入假代码工作界面，支持老板键一键切换。
- 🌐 **多站点标签**：同时打开多个摸鱼站点，标签切换、关闭与恢复。
- ➕ **自定义站点**：支持添加、编辑和删除站点，列表自动持久化。
- 👁 **悬停预览**：老板模式下悬停代码区左下角 `⋯` 预览站点，移开自动隐藏，也可钉住。
- ⌨️ **老板键与快速隐藏**：`Alt + Q` 切换假代码界面，`Alt + H` 隐藏 / 显示窗口。
- 🤖 **统一 AI 配置中心**：支持 OpenAI 兼容、Anthropic Claude、Ollama 本地模型，密钥由系统安全存储加密，所有插件与工具可直接共享调用。
- 📦 **托盘与状态持久化**：支持收进托盘、恢复会话、窗口位置和工具状态。

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
| `Alt + Q` | **老板键（全局）** | 切换假代码界面 / 多站点浏览界面 |
| `Alt + H` | **快速隐藏（全局）** | 隐藏窗口，再按一次恢复 |
| `Ctrl + K` / `Cmd + K` | **命令搜索面板** | 搜索并打开工具 |
| `Ctrl + Shift + K` | **全局唤起（全局）** | 在任何程序里唤出窗口并打开命令面板 |
| `Ctrl + Enter` | **钉住预览** | 老板模式下固定当前站点预览 |
| `Esc` | **关闭预览 / 退出全屏** | 预览打开时优先关闭预览 |

> 老板键、快速隐藏和全局唤起可以在「系统设置」里修改，也可以清空以停用。

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

# 编译构建产物（输出至 out/ 目录）
pnpm build

# 预览构建产物
pnpm preview

# 打包当前平台安装包（先编译再打包，产物输出至 dist/ 目录）
pnpm build && pnpm exec electron-builder

# 指定平台打包
pnpm build && pnpm exec electron-builder --win    # Windows
pnpm build && pnpm exec electron-builder --mac    # macOS
pnpm build && pnpm exec electron-builder --linux  # Linux

# 仅生成免安装目录（用于快速验证打包结果）
pnpm build && pnpm exec electron-builder --dir
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

工具如果需要调用全局配置的 AI 模型（支持流式输出与中断），可以直接引入 `useAi`：

```typescript
import { useAi } from '../../../utils/useAi'

const { askStream, profiles, defaultProfile, isConfigured, stop, openConfig } = useAi()

// 未配置时可调用 openConfig() 跳转至「AI 模型配置」
await askStream([{ role: 'user', content: '你好' }], (delta) => {
  output.value += delta
})
```

---

## 💾 数据存放位置

| 文件 | 内容 |
| :--- | :--- |
| `<userData>/preferences.json` | 设置、窗口尺寸位置、标签会话、收藏、最近使用、各工具状态 |
| `<userData>/sites.json` | 摸鱼浏览器的自定义站点列表 |
| `<userData>/ai-config.json` | AI 模型配置列表（API Key 经 Electron `safeStorage` 加密存储） |

`userData` 目录可以在「系统设置 → 数据与版本」里直接打开。文件损坏时会自动备份为 `.broken-<时间戳>.json` 并回退默认值，不会让应用卡在报错状态。

---

## 📄 开源许可

本项目基于 [MIT](LICENSE) 许可证开源。
