# 个人时间账单与 AI 精力教练 — 功能设计

> 项目：`moyu-app` | Electron + TypeScript + Vue | 本地优先

## 1. 功能定位

通过桌面前台窗口及系统闲置状态，自动记录用户的时间分布，分析工作与专注节奏，并结合 AI 提供每日复盘和工作日报。

- 时间账单：了解编码、调研、沟通、休闲等活动的时间分布。
- 专注分析：统计专注会话、应用切换与疑似专注中断。
- AI 教练：结合历史统计提供工作节奏建议和日报草稿。

## 2. 功能设计

| 模块 | 功能 |
| --- | --- |
| 活动采集 | 后台自动采集、开启/暂停/恢复、闲置检测 |
| 今日账单 | 全天时间轴、工作时长、专注时长、分类占比、Top 应用 |
| 历史趋势 | 按日、周、月查看时间分布和专注趋势 |
| 分类管理 | 内置分类、自定义规则、隐私黑名单、人工修正 |
| AI 教练 | 每日/每周复盘、精力自评、次日建议、日报生成 |
| 轻量联动（可选） | 状态栏专注计时、休息提醒、Git/TODO 工作记录 |

## 3. 活动采集与分类

Main 进程独立运行采集服务，每 3～5 秒获取前台应用及窗口标题，结合 `powerMonitor` 判断系统闲置状态。Windows 优先实现，预留平台适配接口。

采集状态与活动分类分离：

- 状态：`stopped`、`active`、`idle`、`paused`、`locked`、`suspended`、`error`。
- 分类：`deep_work`（编码等）、`research`、`communication`、`leisure`、`other`、`private`。

采集采用单实例、串行轮询。应用、分类或状态变化时切割活动片段，连续相同片段合并。暂停、锁屏、休眠时立即结束活动；恢复后重新采样，不补记未采集时间。异常或时间跳变时不推测未知活动。

普通闲置阈值默认 180 秒，阅读等被动活动可配置延长阈值（建议 600 秒）。达到阈值后仅在可确认的范围内回溯修正活动时间。

分类优先级：隐私黑名单 → 用户规则 → 内置标题规则 → 内置应用规则 → 未分类。同级按规则优先级匹配。支持按应用名和标题关键词匹配，以及单条修正、同日批量修正和创建新规则。默认不保存标题，因此历史记录不支持基于旧标题重新分类。

## 4. 专注分析与统计

| 指标 | 统计口径 |
| --- | --- |
| 有效工作 | 编码、调研、沟通类活动时长之和 |
| 有效活动 | 非隐私的 active 活动时长，含休闲和未分类 |
| 休闲时长 | leisure 活动时长，闲置单独展示 |
| 应用/分类切换 | 连续可观察的非隐私活动中应用/分类变化次数 |
| 专注时长 | 符合专注规则的会话净活动时长之和 |
| 最长专注 | 单个专注会话的最大净活动时长 |

将连续编码、终端操作、技术调研等相关活动合并为 `FocusSession`，允许短时间中断（建议 60 秒），但不将中断时长计入净专注时长。最短专注会话建议 10 分钟。隐私、锁屏、休眠、未知间断不跨越合并。

专注时长是基于活动规则的估算值，不等同于真实心流或工作成果。

## 5. 架构设计

```text
ActivityProvider → Tracker → RuleService → Store → StatsService → AI Service
                                  Main
                                    ↕ IPC
                                 Preload
                                    ↕
                              Vue 工具页面
```

| 服务 | 职责 |
| --- | --- |
| ActivityProvider | 获取平台前台窗口信息 |
| activityTrackerService | 采样、状态管理、活动片段合并 |
| activityRuleService | 分类匹配、隐私过滤 |
| activityStatsService | 聚合统计、专注会话及历史趋势 |
| timeCoachStore | 本地文件存储、恢复与清理 |
| timeCoachAiService | 脱敏摘要、模型调用、复盘与日报 |

按现有 `AGENTS.md` 和工具注册规范组织文件：

```text
src/
├── shared/types.ts
├── main/
│   ├── services/time-coach/   # 采集、分类、统计、存储、AI 服务及 providers/
│   └── ipc/timeCoachIpc.ts
├── preload/index.ts          # window.api.timeCoach
└── renderer/src/tools/system/time-coach/
    ├── manifest.ts
    ├── index.vue
    ├── composables/
    └── components/
```

Main 负责采集、存储和业务计算；Renderer 只负责展示与交互，工具页面关闭不影响已启用的后台采集。Preload 通过白名单 IPC 暴露状态、统计、规则及 AI 接口。

## 6. 核心数据模型与存储

| 模型 | 核心字段 |
| --- | --- |
| ActivitySegment | id、date、timezone、state、category（可选）、appKey/appName（可选）、startAt、endAt |
| ActivityRule | id、name、enabled、priority、source、appPattern、titleKeyword、matchType、category、idlePolicy |
| FocusSession | id、startAt、endAt、activeDurationSec、interruptionCount、segmentIds |
| DailyTimeSummary | date、totalActiveSec、totalWorkSec、focusSec、longestFocusSec、switchCount、categoryTotals、topApps |

继续采用 `app.getPath('userData')/time-coach/` 下的 JSON 存储，不引入 SQLite。

```text
time-coach/
├── settings.json
├── rules.json
├── checkpoint.json
├── activities/YYYY-MM-DD.json
├── summaries/YYYY-MM-DD.json
└── reviews/YYYY-MM-DD.json
```

活动时长由开始和结束时间计算；片段不得重叠，跨天自动拆分。每 60 秒及正常退出时落盘，采用串行原子写入和检查点恢复，不将异常退出至重启期间计入工作。修改分类后重新计算受影响的统计；数据结构保留版本号。

## 7. AI 精力教练

支持 OpenAI 兼容接口和本地 Ollama。基础统计由本地完成，AI 默认手动触发，仅接收当日及最近 7～30 天的脱敏聚合数据，以及用户主动提供的精力自评、目标和备注。

输出每日节奏点评、高切换时段分析、历史变化、次日建议及日报/周报草稿。日报可结合用户记录、Git 或 TODO，但不得根据应用时长编造工作成果。AI 失败不影响本地账单。

## 8. 页面与隐私设计

页面划分为今日概览、历史趋势、AI 教练、规则设置四个区域，状态栏可选展示当前专注时间及暂停快捷操作。

首次默认关闭采集，明确展示运行状态；窗口标题仅在内存中匹配，隐私片段只保存时间范围和状态，不保存应用信息。禁止采集键盘内容、截图、剪贴板或聊天正文。云端 AI 需单独授权并预览发送摘要，密钥由 Main 安全管理，不暴露给 Renderer。支持删除历史及派生数据，活动明细默认建议保留 90 天。`bossMode` 不改变隐私策略或采集授权。

## 9. 实施范围

- Phase 1：活动采集、分类、JSON 存储、今日时间账单与隐私设置。
- Phase 2：历史趋势、专注会话、人工分类修正。
- Phase 3：AI 教练、精力自评、日报/周报。
- Phase 4（可选）：状态栏、休息提醒、Git/TODO 联动。

> 本文仅为功能与架构设计。实际目录及 Windows 前台窗口采集方案以项目源码和实机验证为准。
