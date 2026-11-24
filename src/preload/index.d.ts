import type { ElectronAPI } from '@electron-toolkit/preload'
import type { MoyuPreviewAPI } from '@shared/moyuPreview'

interface WindowAPI {
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  onMaximizedChanged: (callback: (isMaximized: boolean) => void) => void
}

interface API {
  window: WindowAPI
  moyuPreview: MoyuPreviewAPI
  onToggleSearch: (callback: () => void) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
