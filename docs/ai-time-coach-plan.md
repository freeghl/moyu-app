# 桌面活动感知「个人时间账单」与 AI 精力教练 — 设计方案

> 本文档用于规划 `moyu-app` 新增的「个人时间账单 & AI 精力教练」功能，遵循项目现有目录规范与前后端进程职责划分。

---

## 1. 功能定位与核心价值

利用 Electron 桌面端可无感感知前台窗口与系统闲置状态的能力，在**完全保护本地隐私**的前提下，帮助用户：

1. **看清时间去向**：自动统计全天在编码、调研、沟通、摸鱼/休息、离开等状态上的时间分布。
2. **量化专注质量**：不仅统计总时长，还计算**最长连续心流（Deep Work）**与**上下文切换次数**（识别注意力碎片化时段）。
3. **AI 每日复盘与日报生成**：下班前基于脱敏后的统计摘要，由 AI 生成精力画像、防过劳/节奏调整建议，并可一键转为工作日报。
4. **与 `moyu-app` 现有体验联动**：结合状态栏专注提示、温和防过劳提醒以及 `bossMode` 伪装模式，兼顾效率与健康摸鱼。

---

## 2. 核心功能拆解

### 2.1 Phase 1：本地时间账单 MVP（不依赖外部 API）

- **后台静默采集**
  - Main 进程定时（建议每 `3~5s`）获取当前系统前台激活窗口的进程名与窗口标题。
  - 利用 Electron 内置 `powerMonitor.getSystemIdleTime()` 检测键鼠闲置时长，超过阈值（默认 `180s`）自动标记为 `idle`（离开/锁屏），不计入工作或摸鱼时长。
  - 支持随时**开启 / 暂停采集**，并在界面明确展示当前采集状态。
- **自动分类引擎**
  - 内置常见应用分类规则（`deep_work` 深度工作、`research` 调研文档、`communication` 沟通会议、`leisure` 摸鱼休息、`other` 未分类）。
  - 支持用户自定义分类规则（按进程名或窗口标题关键词匹配）与**隐私黑名单**（命中黑名单直接记为 `private` 跳过，不记录任何细节）。
- **今日时间账单视图**
  - **全天时间轴**：按时间先后展示各状态色块，直观看出连续心流与被打断时段。
  - **核心指标卡片**：今日有效专注总时长、最长连续心流时长、窗口切换次数、休息/摸鱼时长。
  - **分类占比与 Top 应用排行**：按分类和应用维度汇总时长。

### 2.2 Phase 2：AI 精力教练与日报生成

- **模型配置**：支持 OpenAI 兼容接口（DeepSeek / OpenAI / 各类中转）及本地 Ollama（离线运行）。
- **每日精力复盘**：
  - 将当日**聚合后的脱敏摘要**（如各时段分类时长、切换频次、最长心流）发送给 AI。
  - 输出：今日节奏点评、高切换碎片时段提醒、明日时间分配建议。
- **一键生成工作日报**：
  - 基于当日专注记录（后续可选联动本地项目 `git log`），一键生成结构化日报/周报草稿。

### 2.3 Phase 3：轻量联动增强（可选）

- **状态栏微挂件**：在 `StatusBar` 显示今日专注时长或当前连续专注计时。
- **温和防过劳提醒**：连续深度工作超过设定阈值（如 `90 分钟`）且无休息时，弹出轻量提示喝水/远眺。

---

## 3. 隐私与安全设计（核心原则）

1. **数据 100% 本地闭环**：所有活动记录仅保存在本地应用数据目录（`app.getPath('userData')`），默认不上传任何原始行为数据。
2. **标题可选不落盘**：窗口标题仅在内存中用于规则分类匹配，可开启「仅保存应用名与分类，不保存窗口标题」模式。
3. **黑名单机制**：命中隐私关键词或指定进程时，统一归类为 `private`，不记录应用名称与标题。
4. **AI 最小化输入**：发送给大模型的仅为**时间段聚合统计摘要**（例如 `09:30-11:10 深度工作 100m，切换 5 次`），绝不发送具体网页标题、文件名或聊天对象。

---

## 4. 架构与目录规划

遵循 `AGENTS.md` 规范，按进程职责划分：

```text
src/
├── shared/
│   └── types.ts                                 # 新增时间账单、分类规则、AI 复盘相关共享类型
├── main/
│   ├── services/
│   │   ├── activityTrackerService.ts            # 前台窗口采集 + powerMonitor 闲置检测 + 内存片段合并
│   │   ├── activityRuleService.ts               # 分类规则匹配、隐私黑名单、统计摘要生成
│   │   └── timeCoachStore.ts                    # 按天持久化存储（userData/time-coach/YYYY-MM-DD.json）
│   └── ipc/
│       └── timeCoachIpc.ts                      # 暴露状态查询、今日账单、规则配置、AI 复盘等 IPC 接口
├── preload/
│   └── index.ts                                 # 挂载 window.api.timeCoach
└── renderer/src/
    └── tools/
        └── system/
            └── time-coach/
                ├── manifest.ts                  # 工具注册元数据
                ├── index.vue                    # 工具主页面（时间轴 / 指标 / 规则 / AI 复盘）
                └── components/                  # 工具专属子组件（TimelineBar, SummaryCards, RuleModal 等）
```

> **存储选型说明**：当前项目（`package.json`）未引入原生 C++ SQLite 依赖（如 `better-sqlite3`），沿用现有 `preferenceStore.ts` / `siteStore.ts` 的纯 JS 文件存储模式（按天分片 JSON + 内存中合并连续片段后落盘）可实现零原生编译依赖、跨平台稳定运行；单日数据量仅数百条片段，读写开销极低。

---

## 5. 核心数据结构草案

```ts
export type ActivityCategory =
  | 'deep_work'     // 深度工作（IDE、终端等）
  | 'research'      // 调研文档（技术文档、浏览器查阅）
  | 'communication' // 沟通会议（IM、邮件、会议软件）
  | 'leisure'       // 摸鱼休息
  | 'idle'          // 离开 / 锁屏
  | 'private'       // 隐私黑名单跳过
  | 'other'         // 未分类

export interface ActivitySegment {
  id: string
  date: string              // YYYY-MM-DD
  category: ActivityCategory
  appName: string           // 进程/应用名（private 模式下脱敏）
  startAt: number           // 毫秒时间戳
  endAt: number             // 毫秒时间戳
  durationSec: number       // 持续秒数
}

export interface ActivityRule {
  id: string
  category: ActivityCategory
  appPattern?: string       // 进程名匹配
  titleKeyword?: string     // 窗口标题关键词匹配（仅本地匹配用）
  isPrivacy?: boolean       // 是否命中即标记为 private
}

export interface DailyTimeSummary {
  date: string
  totalActiveSec: number
  longestDeepWorkSec: number
  contextSwitchCount: number
  categoryTotals: Record<ActivityCategory, number>
  topApps: Array<{ appName: string; category: ActivityCategory; durationSec: number }>
  segments: ActivitySegment[]
}
```

---

## 6. 关键技术细节（Main 进程采集）

1. **Windows 前台窗口获取**：
   - 在 Main 进程通过轻量方案获取当前前台窗口进程名与标题（需注意防重入：上一次调用未返回时不叠加发起下一次，避免定时任务堆积）。
   - 仅当进程名或分类发生变化时，才截断上一个 `ActivitySegment` 并开启新片段，避免高频写盘。
2. **闲置状态衔接**：
   - 每次轮询同时检查 `powerMonitor.getSystemIdleTime()`。
   - 当闲置秒数 `>= idleThresholdSec`（默认 `180`）时，将当前片段切换为 `idle`（并回溯扣除已经处于闲置的这段时间，保证专注时长准确）。
3. **生命周期与落盘**：
   - 每隔 `60s` 以及应用退出（`before-quit`）时，将内存中的当前活跃片段刷新写入当日 JSON 文件。

---

## 7. 推荐实施步骤

1. **Step 1**：在 `src/shared/types.ts` 定义类型，完成 `timeCoachStore.ts` 与 `activityRuleService.ts`（含默认开发常用软件分类表）。
2. **Step 2**：实现 `activityTrackerService.ts`（窗口轮询 + 闲置检测 + 片段合并）并在 `lifecycle.ts` 中接入启停。
3. **Step 3**：注册 `timeCoachIpc.ts` 与 `preload` API。
4. **Step 4**：开发 `src/renderer/src/tools/system/time-coach/`（`manifest.ts` + `index.vue`），先跑通「今日时间账单 + 分类统计 + 规则配置」。
5. **Step 5**：接入 AI 模型配置与每日复盘提示词模板，完成 Phase 2。
