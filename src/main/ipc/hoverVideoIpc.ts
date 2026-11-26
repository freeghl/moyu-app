import { ipcMain } from 'electron'
import { isHoverVideoSourceId, type HoverVideoSourceId } from '@shared/hoverVideo'
import { hoverVideoService } from '../services/hoverVideoService'
import { windowService } from '../services/windowService'
import { isTrustedSender } from './guard'

function isMainWindowSender(event: Electron.IpcMainInvokeEvent): boolean {
  const mainWindow = windowService.getMainWindow()
  return isTrustedSender(event) && Boolean(mainWindow && event.sender.id === mainWindow.webContents.id)
}

function readSource(value: unknown): HoverVideoSourceId {
  if (!isHoverVideoSourceId(value)) throw new Error('不支持的视频来源。')
  return value
}

export function registerHoverVideoIpc(): void {
  ipcMain.handle('hover-video:open-login', (event, source: unknown) => {
    if (!isMainWindowSender(event)) throw new Error('无权打开视频平台登录。')
    return hoverVideoService.openLogin(readSource(source))
  })

  ipcMain.handle('hover-video:finish-login', (event, source: unknown) => {
    if (!isMainWindowSender(event)) throw new Error('无权确认视频平台登录。')
    return hoverVideoService.finishLogin(readSource(source))
  })

  ipcMain.handle('hover-video:capture-hotspot', (event) => {
    if (!isMainWindowSender(event)) throw new Error('无权记录热区。')
    return hoverVideoService.captureHotspot()
  })

  ipcMain.handle('hover-video:remove-hotspot', (event, id: unknown) => {
    if (!isMainWindowSender(event) || typeof id !== 'string') throw new Error('无权删除热区。')
    hoverVideoService.removeHotspot(id)
  })
}
