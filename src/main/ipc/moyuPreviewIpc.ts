import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import type { MoyuPreviewRequest, MoyuSiteChange } from '@shared/moyuPreview'
import { MoyuPreviewService } from '../services/moyuPreviewService'
import { moyuSiteStore } from '../services/moyuSiteStore'

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
  ipcMain.handle('moyu-preview:show', async (event, request: MoyuPreviewRequest) => {
    const preview = getPreview(event)
    if (!preview) return
    const sites = await moyuSiteStore.list()
    const site = sites.find((item) => item.id === request?.siteId)
    if (site) await preview.show(request, site.url)
  })
  ipcMain.handle('moyu-preview:hide', (event) => getPreview(event)?.hide())
  ipcMain.handle('moyu-preview:list-sites', (event) => {
    if (getPreview(event)) return moyuSiteStore.list()
  })
  ipcMain.handle('moyu-preview:change-site', (event, change: MoyuSiteChange) => {
    if (getPreview(event)) return moyuSiteStore.change(change)
  })
}
