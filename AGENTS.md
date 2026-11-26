# AGENTS.md

## 项目目录规范

```text
src/
├── main/              # Electron 主进程
│   ├── ipc/           # IPC 接口
│   ├── services/      # 业务服务
│   ├── database/      # 数据库
│   └── workers/       # 后台任务
├── preload/           # 进程通信
├── renderer/src/      # 前端
│   ├── assets/        # 静态资源
│   ├── layouts/       # 页面布局
│   ├── components/    # 公共组件
│   ├── stores/        # 状态管理
│   ├── registry/      # 工具注册
│   ├── views/         # 公共页面
│   ├── utils/         # 公共函数
│   └── tools/         # 独立工具
└── shared/            # 跨进程共享代码
docs/                  # 项目文档
scripts/               # 辅助脚本
resources/             # 应用及打包资源
```

## 强制规则

1. 新增文件前必须检查现有目录结构，按照文件职责存放。
2. 独立工具统一存放在 `src/renderer/src/tools/分类/工具名称/` 下。
3. 工具专属组件、函数和类型存放在各自工具目录内，公共代码才放入公共目录。
4. 每个工具通过 `manifest.ts` 注册，使用 `index.vue` 作为页面入口。
5. 文件读写、数据库及系统操作统一放在 Main 进程。
6. 优先复用已有文件和目录，禁止重复创建。
7. 禁止随意在项目根目录创建业务文件。
8. 未经用户允许，不得改变现有目录结构。
9. 应用内所有需要 AI 能力的功能或工具，禁止自行新增模型配置、单独存储 API Key 或重复封装请求逻辑，必须统一复用全局 AI 配置中心。

## 全局 AI 模型配置与调用规范

- **共享类型定义**：`src/shared/ai.ts`（`AiMessage`、`AiChatRequest`、`AiChatResponse`、`AiStreamChunk`、`AiProfile` 等）。
- **渲染进程调用（工具 / 组件）**：
  - 优先使用 `src/renderer/src/utils/useAi.ts` 的 `useAi()`（提供 `ask`、`askStream`、`stop`、`openConfig`、`isConfigured`、`defaultProfile`、`profiles`、`loading`、`error`）。
  - 需要读取或管理配置状态时使用 `src/renderer/src/stores/aiStore.ts` 的 `useAiStore()`（底层经 `window.api.ai` 与 `src/main/ipc/aiIpc.ts` 通信）。
  - 未配置可用模型时，调用 `openConfig()`（即 `tabStore.openTool('ai-config')`）引导用户前往 `src/renderer/src/tools/ai/ai-config/` 进行配置。
- **主进程调用（Main 进程服务）**：
  - 直接复用 `src/main/services/aiClientService.ts` 的 `aiClientService`（`chat` / `chatStream` / `abort`），或通过 `src/main/services/aiConfigStore.ts` 的 `aiConfigStore` 获取配置。
