import { randomUUID } from 'node:crypto'
import type {
  ActivityCategory,
  ActivityRule,
  ActivityRuleInput,
  DailyTimeSummary,
  TimeCoachDailyNote,
  TrendPoint
} from '@shared/timeCoach'
import { timeCoachStore } from './timeCoachStore'

export const BUILTIN_RULES: readonly ActivityRule[] = [
  // 隐私黑名单（最高优先级）
  {
    id: 'builtin-privacy-pwd',
    name: '密码管理器',
    enabled: true,
    priority: 1000,
    source: 'builtin',
    appPattern: 'keepass|1password|bitwarden|enpass',
    isPrivacy: true,
    category: 'private'
  },
  {
    id: 'builtin-privacy-incognito',
    name: '浏览器无痕/网银标题',
    enabled: true,
    priority: 990,
    source: 'builtin',
    titleKeyword: 'inprivate|incognito|无痕|网上银行|网银|支付宝收银台',
    isPrivacy: true,
    category: 'private'
  },
  // 深度工作（IDE / 终端 / 设计工具）
  {
    id: 'builtin-dw-vscode',
    name: 'VS Code / Cursor / Trae',
    enabled: true,
    priority: 800,
    source: 'builtin',
    appPattern: 'code|cursor|trae|windsurf|zed',
    category: 'deep_work'
  },
  {
    id: 'builtin-dw-jetbrains',
    name: 'JetBrains IDE',
    enabled: true,
    priority: 790,
    source: 'builtin',
    appPattern: 'idea64|webstorm64|pycharm64|goland64|clion64|rider64|datagrip64',
    category: 'deep_work'
  },
  {
    id: 'builtin-dw-terminal',
    name: '终端与命令行',
    enabled: true,
    priority: 780,
    source: 'builtin',
    appPattern: 'windowsterminal|wt|pwsh|powershell|cmd|alacritty|wezterm-gui|mintty|tabby',
    category: 'deep_work'
  },
  {
    id: 'builtin-dw-dev-tools',
    name: '开发调试工具',
    enabled: true,
    priority: 770,
    source: 'builtin',
    appPattern: 'devenv|postman|apifox|navicat|dbeaver|obsidian|notion|figma',
    category: 'deep_work'
  },
  // 浏览器标题细分规则（优先级高于纯应用规则）
  {
    id: 'builtin-title-leisure',
    name: '视频/娱乐网页',
    enabled: true,
    priority: 650,
    source: 'builtin',
    appPattern: 'chrome|msedge|firefox|brave|arc',
    titleKeyword: 'bilibili|哔哩哔哩|youtube|douyin|抖音|weibo|微博|zhihu|知乎|iqiyi|youku|netflix|twitch|虎牙|斗鱼',
    category: 'leisure'
  },
  {
    id: 'builtin-title-research',
    name: '技术文档与调研网页',
    enabled: true,
    priority: 640,
    source: 'builtin',
    appPattern: 'chrome|msedge|firefox|brave|arc',
    titleKeyword: 'github|gitlab|stackoverflow|mdn|docs|localhost|127\\.0\\.0\\.1|juejin|掘金|npmjs|vuejs|typescriptlang|chatgpt|claude|deepseek|gemini',
    category: 'research',
    idleThresholdSec: 600
  },
  // 沟通协作
  {
    id: 'builtin-comm-im',
    name: '即时通讯与会议',
    enabled: true,
    priority: 550,
    source: 'builtin',
    appPattern: 'wechat|weixin|wxwork|feishu|lark|dingtalk|slack|teams|ms-teams|qq|discord|telegram|zoom|wemeet|outlook|thunderbird',
    category: 'communication'
  },
  // 摸鱼休闲
  {
    id: 'builtin-leisure-apps',
    name: '音乐/游戏/播放器',
    enabled: true,
    priority: 500,
    source: 'builtin',
    appPattern: 'steam|epicgameslauncher|cloudmusic|qqmusic|spotify|potplayer|vlc',
    category: 'leisure'
  },
  // 浏览器兜底归为调研
  {
    id: 'builtin-browser-default',
    name: '浏览器（默认调研）',
    enabled: true,
    priority: 300,
    source: 'builtin',
    appPattern: 'chrome|msedge|firefox|brave|arc',
    category: 'research',
    idleThresholdSec: 600
  }
]

function matchesPattern(value: string, pattern?: string): boolean {
  if (!pattern?.trim()) return true
  try {
    const regex = new RegExp(pattern.trim(), 'i')
    return regex.test(value)
  } catch {
    return value.toLowerCase().includes(pattern.trim().toLowerCase())
  }
}

export interface MatchResult {
  category: ActivityCategory
  isPrivacy: boolean
  matchedRule?: ActivityRule
  idleThresholdSec?: number
  resolvedAppKey: string
  resolvedAppName?: string
}

const APP_DISPLAY_NAMES: Record<string, string> = {
  code: 'VS Code',
  cursor: 'Cursor',
  trae: 'Trae',
  windsurf: 'Windsurf',
  zed: 'Zed',
  idea64: 'IntelliJ IDEA',
  webstorm64: 'WebStorm',
  pycharm64: 'PyCharm',
  goland64: 'GoLand',
  clion64: 'CLion',
  rider64: 'Rider',
  datagrip64: 'DataGrip',
  devenv: 'Visual Studio',
  windowsterminal: 'Windows Terminal',
  wt: 'Windows Terminal',
  pwsh: 'PowerShell',
  powershell: 'PowerShell',
  cmd: '命令提示符',
  msedge: 'Edge',
  chrome: 'Chrome',
  firefox: 'Firefox',
  brave: 'Brave',
  arc: 'Arc',
  wechat: '微信',
  weixin: '微信',
  wxwork: '企业微信',
  feishu: '飞书',
  lark: 'Lark',
  dingtalk: '钉钉',
  slack: 'Slack',
  teams: 'Teams',
  'ms-teams': 'Teams',
  qq: 'QQ',
  discord: 'Discord',
  telegram: 'Telegram',
  wemeet: '腾讯会议',
  zoom: 'Zoom',
  outlook: 'Outlook',
  obsidian: 'Obsidian',
  notion: 'Notion',
  figma: 'Figma',
  postman: 'Postman',
  apifox: 'Apifox',
  navicat: 'Navicat',
  dbeaver: 'DBeaver',
  cloudmusic: '网易云音乐',
  qqmusic: 'QQ 音乐',
  spotify: 'Spotify',
  steam: 'Steam',
  explorer: '文件资源管理器',
  electron: 'Moyu App'
}

const BROWSER_KEYS = new Set(['chrome', 'msedge', 'firefox', 'brave', 'arc'])

const KNOWN_WEB_APPS: Array<{ key: string; label: string; pattern: RegExp }> = [
  { key: 'github', label: 'GitHub', pattern: /github/i },
  { key: 'gitlab', label: 'GitLab', pattern: /gitlab/i },
  { key: 'localhost', label: '本地调试', pattern: /localhost|127\.0\.0\.1/i },
  { key: 'stackoverflow', label: 'Stack Overflow', pattern: /stack\s*overflow/i },
  { key: 'mdn', label: 'MDN 文档', pattern: /mdn web docs|mozilla developer/i },
  { key: 'juejin', label: '掘金', pattern: /掘金|juejin/i },
  { key: 'chatgpt', label: 'ChatGPT', pattern: /chatgpt/i },
  { key: 'claude', label: 'Claude', pattern: /claude/i },
  { key: 'deepseek', label: 'DeepSeek', pattern: /deepseek/i },
  { key: 'gemini', label: 'Gemini', pattern: /gemini/i },
  { key: 'feishu-doc', label: '飞书文档', pattern: /飞书|feishu/i },
  { key: 'yuque', label: '语雀', pattern: /语雀|yuque/i },
  { key: 'notion-web', label: 'Notion', pattern: /notion/i },
  { key: 'bilibili', label: 'Bilibili', pattern: /bilibili|哔哩哔哩/i },
  { key: 'youtube', label: 'YouTube', pattern: /youtube/i },
  { key: 'zhihu', label: '知乎', pattern: /知乎|zhihu/i },
  { key: 'weibo', label: '微博', pattern: /微博|weibo/i },
  { key: 'douyin', label: '抖音', pattern: /抖音|douyin/i }
]

const UWP_APPS: Array<{ key: string; label: string; pattern: RegExp }> = [
  { key: 'settings', label: '系统设置', pattern: /设置|settings/i },
  { key: 'calculator', label: '计算器', pattern: /计算器|calculator/i },
  { key: 'store', label: 'Microsoft Store', pattern: /microsoft store/i },
  { key: 'photos', label: '照片', pattern: /照片|photos/i }
]

function resolveAppIdentity(
  rawAppName: string,
  windowTitle: string,
  isPrivacy: boolean
): { appKey: string; appName?: string } {
  if (isPrivacy) {
    return { appKey: 'private', appName: undefined }
  }
  const rawKey = rawAppName.trim().toLowerCase()
  const displayName = APP_DISPLAY_NAMES[rawKey] ?? rawAppName.trim()

  if (BROWSER_KEYS.has(rawKey) && windowTitle) {
    const matched = KNOWN_WEB_APPS.find((item) => item.pattern.test(windowTitle))
    if (matched) {
      return {
        appKey: `${rawKey}::${matched.key}`,
        appName: `${displayName} · ${matched.label}`
      }
    }
  }

  if (rawKey === 'applicationframehost' && windowTitle) {
    const matched = UWP_APPS.find((item) => item.pattern.test(windowTitle))
    if (matched) {
      return {
        appKey: `uwp::${matched.key}`,
        appName: `Windows · ${matched.label}`
      }
    }
  }

  return { appKey: rawKey, appName: displayName }
}

function formatDurationHm(sec: number): string {
  const m = Math.round(sec / 60)
  const h = Math.floor(m / 60)
  const rem = m % 60
  if (h <= 0) return `${rem}m`
  return rem > 0 ? `${h}h${rem}m` : `${h}h`
}

function formatClock(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

class ActivityRuleService {
  private userRulesCache: ActivityRule[] | null = null

  async getAllRules(): Promise<ActivityRule[]> {
    if (!this.userRulesCache) {
      const stored = await timeCoachStore.getUserRules()
      this.userRulesCache = stored ?? []
    }
    return [...this.userRulesCache, ...BUILTIN_RULES]
  }

  async getUserRules(): Promise<ActivityRule[]> {
    if (!this.userRulesCache) {
      this.userRulesCache = (await timeCoachStore.getUserRules()) ?? []
    }
    return this.userRulesCache
  }

  async saveUserRule(input: ActivityRuleInput): Promise<ActivityRule[]> {
    const current = [...(await this.getUserRules())]
    const rule: ActivityRule = {
      id: input.id || `user-${randomUUID()}`,
      name: input.name.trim() || '自定义规则',
      enabled: input.enabled ?? true,
      priority: input.priority ?? 900,
      source: 'user',
      appPattern: input.appPattern?.trim() || undefined,
      titleKeyword: input.titleKeyword?.trim() || undefined,
      isPrivacy: Boolean(input.isPrivacy || input.category === 'private'),
      category: input.isPrivacy ? 'private' : input.category,
      idleThresholdSec: input.idleThresholdSec
    }

    const idx = current.findIndex((r) => r.id === rule.id)
    if (idx >= 0) {
      current[idx] = rule
    } else {
      current.unshift(rule)
    }
    this.userRulesCache = current
    await timeCoachStore.saveUserRules(current)
    return this.getAllRules()
  }

  async deleteUserRule(id: string): Promise<ActivityRule[]> {
    const current = (await this.getUserRules()).filter((r) => r.id !== id)
    this.userRulesCache = current
    await timeCoachStore.saveUserRules(current)
    return this.getAllRules()
  }

  async match(appName: string, windowTitle: string): Promise<MatchResult> {
    const rules = (await this.getAllRules()).filter((r) => r.enabled)
    const previewIdentity = resolveAppIdentity(appName, windowTitle, false)
    const appCandidates = previewIdentity.appName
      ? [appName, previewIdentity.appName]
      : [appName]

    // 1. 隐私黑名单优先（无论来源）
    const privacyRules = rules
      .filter((r) => r.isPrivacy || r.category === 'private')
      .sort((a, b) => b.priority - a.priority)
    for (const rule of privacyRules) {
      if (this.isRuleMatched(rule, appCandidates, windowTitle)) {
        return {
          category: 'private',
          isPrivacy: true,
          matchedRule: rule,
          resolvedAppKey: 'private'
        }
      }
    }

    // 2. 用户规则 -> 内置标题规则 -> 内置应用规则
    const tiers: ActivityRule[][] = [
      rules.filter((r) => r.source === 'user' && !r.isPrivacy && r.category !== 'private'),
      rules.filter((r) => r.source === 'builtin' && !r.isPrivacy && Boolean(r.titleKeyword)),
      rules.filter((r) => r.source === 'builtin' && !r.isPrivacy && !r.titleKeyword)
    ]

    for (const tier of tiers) {
      tier.sort((a, b) => b.priority - a.priority)
      for (const rule of tier) {
        if (this.isRuleMatched(rule, appCandidates, windowTitle)) {
          return {
            category: rule.category,
            isPrivacy: false,
            matchedRule: rule,
            idleThresholdSec: rule.idleThresholdSec,
            resolvedAppKey: previewIdentity.appKey,
            resolvedAppName: previewIdentity.appName
          }
        }
      }
    }

    return {
      category: 'other',
      isPrivacy: false,
      resolvedAppKey: previewIdentity.appKey,
      resolvedAppName: previewIdentity.appName
    }
  }

  private isRuleMatched(rule: ActivityRule, appCandidates: string[], windowTitle: string): boolean {
    if (!rule.appPattern && !rule.titleKeyword) return false
    const appOk = rule.appPattern
      ? appCandidates.some((candidate) => matchesPattern(candidate, rule.appPattern))
      : true
    const titleOk = rule.titleKeyword ? matchesPattern(windowTitle, rule.titleKeyword) : true
    return appOk && titleOk
  }

  /**
   * 生成脱敏后的 AI 统计摘要：仅包含聚合时长、时段节奏、切换次数与用户自填备注，
   * 绝不包含窗口标题或隐私应用名称。
   */
  buildAiDigest(
    summary: DailyTimeSummary,
    trends: TrendPoint[],
    note: TimeCoachDailyNote
  ): string {
    const lines: string[] = []
    lines.push(`# 工作统计脱敏摘要 (${summary.date})`)
    lines.push('')
    lines.push('## 1. 当日核心指标')
    lines.push(`- 有效工作总时长: ${formatDurationHm(summary.totalWorkSec)}`)
    lines.push(`- 净专注时长 (Focus Sessions): ${formatDurationHm(summary.focusSec)}`)
    lines.push(`- 最长连续专注: ${formatDurationHm(summary.longestFocusSec)}`)
    lines.push(`- 摸鱼/休闲时长: ${formatDurationHm(summary.leisureSec)}`)
    lines.push(`- 离开/闲置时长: ${formatDurationHm(summary.idleSec)}`)
    lines.push(`- 应用/分类切换次数: ${summary.switchCount} 次`)
    lines.push('')
    lines.push('## 2. 分类时长分布')
    lines.push(`- 深度工作 (deep_work): ${formatDurationHm(summary.categoryTotals.deep_work)}`)
    lines.push(`- 调研文档 (research): ${formatDurationHm(summary.categoryTotals.research)}`)
    lines.push(`- 沟通协作 (communication): ${formatDurationHm(summary.categoryTotals.communication)}`)
    lines.push(`- 摸鱼休息 (leisure): ${formatDurationHm(summary.categoryTotals.leisure)}`)
    lines.push(`- 其他未分类 (other): ${formatDurationHm(summary.categoryTotals.other)}`)

    if (summary.focusSessions.length > 0) {
      lines.push('')
      lines.push('## 3. 连续专注时段')
      for (const s of summary.focusSessions) {
        lines.push(
          `- ${formatClock(s.startAt)} - ${formatClock(s.endAt)} (净专注 ${formatDurationHm(s.activeDurationSec)}, 短中断 ${s.interruptionCount} 次)`
        )
      }
    }

    if (summary.topApps.length > 0) {
      lines.push('')
      lines.push('## 4. 主要使用应用 (仅进程名与分类)')
      for (const app of summary.topApps.slice(0, 8)) {
        lines.push(`- ${app.appName} [${app.category}]: ${formatDurationHm(app.durationSec)}`)
      }
    }

    if (trends.length > 1) {
      lines.push('')
      lines.push(`## 5. 近 ${trends.length} 天趋势对比`)
      for (const t of trends) {
        lines.push(
          `- ${t.date}: 工作 ${formatDurationHm(t.totalWorkSec)}, 专注 ${formatDurationHm(t.focusSec)}, 休闲 ${formatDurationHm(t.leisureSec)}, 切换 ${t.switchCount} 次`
        )
      }
    }

    if (note.energyScore || note.goal || note.note) {
      lines.push('')
      lines.push('## 6. 用户自评与工作备注')
      if (note.energyScore) lines.push(`- 今日精力自评: ${note.energyScore} / 5`)
      if (note.goal?.trim()) lines.push(`- 今日目标/完成事项: ${note.goal.trim()}`)
      if (note.note?.trim()) lines.push(`- 补充备注: ${note.note.trim()}`)
    }

    return lines.join('\n')
  }
}

export const activityRuleService = new ActivityRuleService()
