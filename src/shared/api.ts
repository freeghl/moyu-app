import type { SitePreviewAPI } from './sitePreview'
import type { AppPreferences, PreferencesPatch } from './preferences'
import type { BackgroundAPI } from './types'
import type { SystemAPI } from './system'

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
  apply: (bossKey: string, hideKey: string, summonKey: string) => Promise<ShortcutApplyResult>
}

export interface AppAPI {
  window: WindowAPI
  sitePreview: SitePreviewAPI
  prefs: PreferencesAPI
  app: AppShellAPI
  shortcuts: ShortcutsAPI
  background: BackgroundAPI
  system: SystemAPI
  onToggleBoss: (callback: () => void) => () => void
  onToggleSearch: (callback: () => void) => () => void
}
