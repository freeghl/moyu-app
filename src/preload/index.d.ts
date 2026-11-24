import type { ElectronAPI } from '@electron-toolkit/preload'

interface WindowAPI {
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  onMaximizedChanged: (callback: (isMaximized: boolean) => void) => void
}

interface API {
  window: WindowAPI
  onToggleSearch: (callback: () => void) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
