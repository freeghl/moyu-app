import type { SitePreviewAPI } from './sitePreview'
import type { AppPreferences, PreferencesPatch } from './preferences'

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
  apply: (bossKey: string, summonKey: string) => Promise<ShortcutApplyResult>
}

export interface AppAPI {
  window: WindowAPI
  sitePreview: SitePreviewAPI
  prefs: PreferencesAPI
  app: AppShellAPI
  shortcuts: ShortcutsAPI
  onToggleSearch: (callback: () => void) => () => void
}
