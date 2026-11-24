import { ipcMain, BrowserWindow } from 'electron'
import { windowService } from '../services/windowService'

export function registerWindowIpc(): void {
  ipcMain.handle('window:minimize', () => windowService.minimize())
  ipcMain.handle('window:maximize', () => windowService.maximize())
  ipcMain.handle('window:close', () => windowService.close())
  ipcMain.handle('window:isMaximized', () => windowService.isMaximized())
}

export function setupWindowEvents(window: BrowserWindow): void {
  window.on('maximize', () => {
    window.webContents.send('window:maximized-changed', true)
  })
  window.on('unmaximize', () => {
    window.webContents.send('window:maximized-changed', false)
  })
}
