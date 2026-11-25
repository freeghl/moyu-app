import { ipcMain } from 'electron'
import { systemService } from '../services/systemService'

export function registerSystemIpc(): void {
  ipcMain.handle('system:getSnapshot', () => systemService.getSnapshot())
  ipcMain.handle('system:getMetrics', () => systemService.getMetrics())
  ipcMain.handle('system:getProcesses', () => systemService.getProcesses())
}
