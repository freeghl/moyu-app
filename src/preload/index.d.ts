import type { ElectronAPI } from '@electron-toolkit/preload'
import type { BackgroundAPI } from '@shared/types'
import type { SystemAPI } from '@shared/system'

interface WindowAPI {
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  onMaximizedChanged: (callback: (isMaximized: boolean) => void) => void
}

interface API {
  system: SystemAPI
  window: WindowAPI
  background: BackgroundAPI
  onToggleSearch: (callback: () => void) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
