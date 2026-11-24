import { BrowserWindow } from 'electron'

export class WindowService {
  private static instance: WindowService
  private mainWindow: BrowserWindow | null = null

  private constructor() {}

  static getInstance(): WindowService {
    if (!WindowService.instance) {
      WindowService.instance = new WindowService()
    }
    return WindowService.instance
  }

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  minimize(): void {
    this.mainWindow?.minimize()
  }

  maximize(): void {
    if (this.mainWindow?.isMaximized()) {
      this.mainWindow.unmaximize()
    } else {
      this.mainWindow?.maximize()
    }
  }

  close(): void {
    this.mainWindow?.close()
  }

  isMaximized(): boolean {
    return this.mainWindow?.isMaximized() ?? false
  }
}

export const windowService = WindowService.getInstance()
