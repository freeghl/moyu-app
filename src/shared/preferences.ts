import { CATEGORY_IDS } from './categories'
import { HOVER_VIDEO_SOURCE_IDS, type HoverVideoHotspot, type HoverVideoPreferences, type HoverVideoSourceId } from './hoverVideo'
import type { ToolCategory, WorkspaceItem } from './types'

/** 全局快捷键与启动行为 */
export interface AppSettings {
  /** 关闭主窗口时最小化到托盘，而不是退出 */
  closeToTray: boolean
  /** 启动时恢复上次打开的标签页 */
  restoreSession: boolean
  /** 老板键（切换假代码界面 / 摸鱼界面），空字符串表示不启用 */
  bossKey: string
  /** 快速隐藏（隐藏 / 显示主窗口），空字符串表示不启用 */
  hideKey: string
  /** 全局唤出（显示窗口并打开命令面板） */
  summonKey: string
  /** 悬浮视频上一条，空字符串表示不启用 */
  videoPreviousKey: string
  /** 悬浮视频下一条，空字符串表示不启用 */
  videoNextKey: string
}

/** 主窗口尺寸与位置记忆 */
export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

/** 上次退出时的界面现场 */
export interface SessionState {
  tabs: string[]
  activeToolId: string | null
  workspace: WorkspaceItem
  category: ToolCategory | null
  sidebarCollapsed: boolean
  collapsedCategories: ToolCategory[]
}

export type ToolState = Record<string, unknown>

export interface AppPreferences {
  settings: AppSettings
  window: WindowState
  session: SessionState
  favorites: string[]
  recentTools: string[]
  tools: Record<string, ToolState>
  hoverVideo: HoverVideoPreferences
}

export interface PreferencesPatch {
  settings?: Partial<AppSettings>
  window?: Partial<WindowState>
  session?: Partial<SessionState>
  favorites?: string[]
  recentTools?: string[]
  tools?: Record<string, ToolState>
  hoverVideo?: Partial<HoverVideoPreferences>
}

const WORKSPACES: readonly WorkspaceItem[] = ['home', 'all', 'favorites', 'recent', 'settings']

const MAX_FILES = 500
const MAX_STRING = 2048

export function createDefaultPreferences(): AppPreferences {
  return {
    settings: {
      closeToTray: false,
      restoreSession: true,
      bossKey: 'Alt+Q',
      hideKey: 'Alt+H',
      summonKey: 'CommandOrControl+Shift+K',
      videoPreviousKey: 'CommandOrControl+Up',
      videoNextKey: 'CommandOrControl+Down'
    },
    window: { width: 1400, height: 900, maximized: false },
    session: {
      tabs: [],
      activeToolId: null,
      workspace: 'home',
      category: null,
      sidebarCollapsed: false,
      collapsedCategories: []
    },
    favorites: [],
    recentTools: [],
    tools: {},
    hoverVideo: {
      enabled: false,
      muted: true,
      sources: [...HOVER_VIDEO_SOURCE_IDS],
      hotspots: []
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function readNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback
}

function readText(value: unknown, fallback: string, maxLength = 64): string {
  return typeof value === 'string' && value.length <= MAX_STRING ? value.slice(0, maxLength) : fallback
}

function readStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  for (const item of value) {
    if (item === undefined) continue
    if (typeof item !== 'string' || !item || item.length > 128) continue
    if (!result.includes(item)) result.push(item)
    if (result.length >= limit) break
  }
  return result
}

function readCategories(value: unknown): ToolCategory[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is ToolCategory => CATEGORY_IDS.includes(item as ToolCategory))
}

function readWindow(value: unknown, fallback: WindowState): WindowState {
  if (!isRecord(value)) return { ...fallback }
  return {
    x: typeof value.x === 'number' && Number.isFinite(value.x) ? readNumber(value.x, 0, -20000, 20000) : undefined,
    y: typeof value.y === 'number' && Number.isFinite(value.y) ? readNumber(value.y, 0, -20000, 20000) : undefined,
    width: readNumber(value.width, fallback.width, 960, 8000),
    height: readNumber(value.height, fallback.height, 640, 8000),
    maximized: readBoolean(value.maximized, false)
  }
}

function readSession(value: unknown, fallback: SessionState): SessionState {
  if (!isRecord(value)) return { ...fallback }
  const workspace = WORKSPACES.includes(value.workspace as WorkspaceItem) ? value.workspace as WorkspaceItem : fallback.workspace
  const category = CATEGORY_IDS.includes(value.category as ToolCategory) ? value.category as ToolCategory : null
  return {
    tabs: readStringArray(value.tabs, 24),
    activeToolId: typeof value.activeToolId === 'string' ? value.activeToolId : null,
    workspace,
    category,
    sidebarCollapsed: readBoolean(value.sidebarCollapsed, fallback.sidebarCollapsed),
    collapsedCategories: readCategories(value.collapsedCategories)
  }
}

function readTools(value: unknown): Record<string, ToolState> {
  if (!isRecord(value)) return {}
  const tools: Record<string, ToolState> = {}
  for (const [key, state] of Object.entries(value)) {
    if (!isRecord(state) || key.length > 128) continue
    tools[key] = state
  }
  return tools
}

function readHoverVideo(value: unknown, fallback: HoverVideoPreferences): HoverVideoPreferences {
  if (!isRecord(value)) return { ...fallback, hotspots: [] }

  const hotspots: HoverVideoHotspot[] = []
  if (Array.isArray(value.hotspots)) {
    for (const item of value.hotspots) {
      if (!isRecord(item) || typeof item.id !== 'string' || !item.id || item.id.length > 128) continue
      if (hotspots.some((hotspot) => hotspot.id === item.id)) continue
      hotspots.push({
        id: item.id,
        name: readText(item.name, '桌面热区', 64),
        x: readNumber(item.x, 0, -20000, 20000),
        y: readNumber(item.y, 0, -20000, 20000),
        width: readNumber(item.width, 84, 24, 400),
        height: readNumber(item.height, 84, 24, 400),
        displayId: readNumber(item.displayId, 0, -100, 10000)
      })
      if (hotspots.length >= 100) break
    }
  }

  const sources: HoverVideoSourceId[] = []
  if (Array.isArray(value.sources)) {
    for (const item of value.sources) {
      if (typeof item !== 'string' || !HOVER_VIDEO_SOURCE_IDS.includes(item as HoverVideoSourceId)) continue
      if (sources.includes(item as HoverVideoSourceId)) continue
      sources.push(item as HoverVideoSourceId)
    }
  }

  return {
    enabled: readBoolean(value.enabled, fallback.enabled),
    muted: readBoolean(value.muted, fallback.muted),
    sources: sources.length ? sources : [...fallback.sources],
    hotspots
  }
}

/** 把磁盘上的任意内容收敛成合法的偏好结构，避免脏数据把应用卡死 */
export function normalizePreferences(raw: unknown): AppPreferences {
  const defaults = createDefaultPreferences()
  if (!isRecord(raw)) return defaults

  const settings = isRecord(raw.settings) ? raw.settings : {}
  const legacyBossKeyWasHide = !('hideKey' in settings) && settings.bossKey === 'CommandOrControl+Shift+H'
  return {
    settings: {
      closeToTray: readBoolean(settings.closeToTray, defaults.settings.closeToTray),
      restoreSession: readBoolean(settings.restoreSession, defaults.settings.restoreSession),
      bossKey: legacyBossKeyWasHide ? defaults.settings.bossKey : readText(settings.bossKey, defaults.settings.bossKey),
      hideKey: readText(settings.hideKey, defaults.settings.hideKey),
      summonKey: readText(settings.summonKey, defaults.settings.summonKey),
      videoPreviousKey: readText(settings.videoPreviousKey, defaults.settings.videoPreviousKey),
      videoNextKey: readText(settings.videoNextKey, defaults.settings.videoNextKey)
    },
    window: readWindow(raw.window, defaults.window),
    session: readSession(raw.session, defaults.session),
    favorites: readStringArray(raw.favorites, MAX_FILES),
    recentTools: readStringArray(raw.recentTools, 30),
    tools: readTools(raw.tools),
    hoverVideo: readHoverVideo(raw.hoverVideo, defaults.hoverVideo)
  }
}

/** 把补丁合并进当前偏好（数组整体替换，对象浅合并） */
export function mergePreferences(base: AppPreferences, patch: PreferencesPatch): AppPreferences {
  return {
    settings: { ...base.settings, ...patch.settings },
    window: { ...base.window, ...patch.window },
    session: { ...base.session, ...patch.session },
    favorites: patch.favorites ?? base.favorites,
    recentTools: patch.recentTools ?? base.recentTools,
    tools: { ...base.tools, ...patch.tools },
    hoverVideo: { ...base.hoverVideo, ...patch.hoverVideo }
  }
}

/** 累积多个未落盘的补丁 */
export function mergePatches(base: PreferencesPatch | undefined, next: PreferencesPatch): PreferencesPatch {
  if (!base) return next
  return {
    settings: { ...base.settings, ...next.settings },
    window: { ...base.window, ...next.window },
    session: { ...base.session, ...next.session },
    favorites: next.favorites ?? base.favorites,
    recentTools: next.recentTools ?? base.recentTools,
    tools: { ...base.tools, ...next.tools },
    hoverVideo: next.hoverVideo || base.hoverVideo
      ? { ...base.hoverVideo, ...next.hoverVideo }
      : undefined
  }
}
