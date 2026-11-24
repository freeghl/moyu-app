import type { ElectronAPI } from '@electron-toolkit/preload'

export interface WindowAPI {
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  onMaximizedChanged: (callback: (isMaximized: boolean) => void) => void
}

export interface AppAPI {
  window: WindowAPI
  onToggleSearch: (callback: () => void) => void
}

declare global {
  interface Window {
    electron?: ElectronAPI
    api?: AppAPI
  }
}
