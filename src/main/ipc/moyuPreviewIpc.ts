import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import type { MoyuPreviewRequest } from '@shared/moyuPreview'
import { MoyuPreviewService } from '../services/moyuPreviewService'

const previews = new Map<number, MoyuPreviewService>()

export function setupMoyuPreview(window: BrowserWindow): void {
  const id = window.webContents.id
  previews.set(id, new MoyuPreviewService(window))
  window.once('closed', () => previews.delete(id))
}

export function hideMoyuPreview(window: BrowserWindow): void {
  previews.get(window.webContents.id)?.hide()
}

function getPreview(event: IpcMainInvokeEvent): MoyuPreviewService | undefined {
  if (event.senderFrame !== event.sender.mainFrame) return
  return previews.get(event.sender.id)
}

export function registerMoyuPreviewIpc(): void {
  ipcMain.handle('moyu-preview:show', (event, request: MoyuPreviewRequest) => getPreview(event)?.show(request))
  ipcMain.handle('moyu-preview:hide', (event) => getPreview(event)?.hide())
}
