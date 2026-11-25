import { ipcMain } from 'electron'
import { backgroundService } from '../services/backgroundService'

export function registerBackgroundIpc(): void {
  ipcMain.handle('background:select', () => backgroundService.select())
  ipcMain.handle('background:load', (_, fileName: string) => backgroundService.load(fileName))
  ipcMain.handle('background:remove', (_, fileName: string) => backgroundService.remove(fileName))
}
