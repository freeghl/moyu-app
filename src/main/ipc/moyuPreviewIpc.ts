import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import type { MoyuPreviewRequest, MoyuSiteChange, PreviewCommand } from '@shared/moyuPreview'
import { MoyuPreviewService } from '../services/moyuPreviewService'
import { moyuSiteStore } from '../services/moyuSiteStore'
import { isTrustedSender } from './guard'

const previews = new Map<number, MoyuPreviewService>()

export function setupMoyuPreview(window: BrowserWindow): void {
  const id = window.webContents.id
  previews.set(id, new MoyuPreviewService(window))
  window.once('closed', () => previews.delete(id))
}

export function hideMoyuPreview(window: BrowserWindow): void {
  if (window.isDestroyed()) return
  previews.get(window.webContents.id)?.hide()
}

function getPreview(event: IpcMainInvokeEvent): MoyuPreviewService | undefined {
  if (!isTrustedSender(event)) return
  return previews.get(event.sender.id)
}

export function registerMoyuPreviewIpc(): void {
  ipcMain.handle('moyu-preview:show', async (event, request: MoyuPreviewRequest) => {
    const preview = getPreview(event)
    if (!preview || !request || typeof request.siteId !== 'string') return
    const sites = await moyuSiteStore.list()
    const site = sites.find((item) => item.id === request.siteId)
    if (site) await preview.show(request, site.url)
  })
  ipcMain.handle('moyu-preview:hide', (event) => getPreview(event)?.hide())
  ipcMain.handle('moyu-preview:pin', (event, pinned: unknown) => getPreview(event)?.pin(pinned === true))
  ipcMain.handle('moyu-preview:command', (event, command: PreviewCommand) => {
    const allowed: PreviewCommand[] = ['back', 'forward', 'reload', 'fullscreen', 'close']
    if (!allowed.includes(command)) return
    getPreview(event)?.command(command)
  })
  ipcMain.handle('moyu-preview:list-sites', (event) => {
    if (getPreview(event)) return moyuSiteStore.list()
  })
  ipcMain.handle('moyu-preview:change-site', (event, change: MoyuSiteChange) => {
    if (getPreview(event)) return moyuSiteStore.change(change)
  })
}
