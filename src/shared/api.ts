import type { SitePreviewAPI } from './sitePreview'
import type { AppPreferences, PreferencesPatch } from './preferences'
import type { BackgroundAPI } from './types'
import type { SystemAPI } from './system'
import type { TimeCoachAPI } from './timeCoach'
import type {
  AiChatRequest,
  AiChatResponse,
  AiConfigState,
  AiModelListResult,
  AiProfileInput,
  AiStreamChunk,
  AiTestResult
} from './ai'
import type { HoverVideoAPI } from './hoverVideo'

export interface WindowAPI {
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  onMaximizedChanged: (callback: (isMaximized: boolean) => void) => () => void
}

export interface ShortcutApplyResult {
  ok: boolean
  error?: string
}

export interface PreferencesAPI {
  get: () => Promise<AppPreferences>
  patch: (patch: PreferencesPatch) => Promise<AppPreferences>
}

export interface AppShellAPI {
  version: () => Promise<string>
  dataDir: () => Promise<string>
  openDataDir: () => Promise<void>
  hideToTray: () => Promise<void>
  quit: () => Promise<void>
}

export interface ShortcutsAPI {
  apply: (
    bossKey: string,
    hideKey: string,
    summonKey: string,
    videoPreviousKey: string,
    videoNextKey: string
  ) => Promise<ShortcutApplyResult>
}

export interface AiAPI {
  getConfig: () => Promise<AiConfigState>
  saveProfile: (input: AiProfileInput) => Promise<AiConfigState>
  deleteProfile: (id: string) => Promise<AiConfigState>
  setDefault: (id: string | null) => Promise<AiConfigState>
  testConnection: (input: AiProfileInput) => Promise<AiTestResult>
  listModels: (input: AiProfileInput) => Promise<AiModelListResult>
  chat: (request: AiChatRequest) => Promise<AiChatResponse>
  chatStream: (request: AiChatRequest) => Promise<void>
  abort: (requestId: string) => Promise<void>
  onStreamChunk: (callback: (chunk: AiStreamChunk) => void) => () => void
}

export interface AppAPI {
  window: WindowAPI
  sitePreview: SitePreviewAPI
  prefs: PreferencesAPI
  app: AppShellAPI
  shortcuts: ShortcutsAPI
  background: BackgroundAPI
  system: SystemAPI
  ai: AiAPI
  timeCoach: TimeCoachAPI
  hoverVideo: HoverVideoAPI
  onToggleBoss: (callback: () => void) => () => void
  onToggleSearch: (callback: () => void) => () => void
}
