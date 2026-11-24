import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import type { PreviewCommand, SiteChange, SitePreviewRequest } from '@shared/sitePreview'
import { SitePreviewService } from '../services/sitePreviewService'
import { siteStore } from '../services/siteStore'
import { isTrustedSender } from './guard'

const previews = new Map<number, SitePreviewService>()

export function setupSitePreview(window: BrowserWindow): void {
  const id = window.webContents.id
  previews.set(id, new SitePreviewService(window))
  window.once('closed', () => previews.delete(id))
}

export function hideSitePreview(window: BrowserWindow): void {
  if (window.isDestroyed()) return
  previews.get(window.webContents.id)?.hide()
}

function getPreview(event: IpcMainInvokeEvent): SitePreviewService | undefined {
  if (!isTrustedSender(event)) return
  return previews.get(event.sender.id)
}

export function registerSitePreviewIpc(): void {
  ipcMain.handle('site-preview:show', async (event, request: SitePreviewRequest) => {
    const preview = getPreview(event)
    if (!preview || !request || typeof request.siteId !== 'string') return
    const sites = await siteStore.list()
    const site = sites.find((item) => item.id === request.siteId)
    if (site) await preview.show(request, site.url)
  })
  ipcMain.handle('site-preview:hide', (event) => getPreview(event)?.hide())
  ipcMain.handle('site-preview:pin', (event, pinned: unknown) => getPreview(event)?.pin(pinned === true))
  ipcMain.handle('site-preview:command', (event, command: PreviewCommand) => {
    const allowed: PreviewCommand[] = ['back', 'forward', 'reload', 'fullscreen', 'close']
    if (!allowed.includes(command)) return
    getPreview(event)?.command(command)
  })
  ipcMain.handle('site-preview:list-sites', (event) => {
    if (getPreview(event)) return siteStore.list()
  })
  ipcMain.handle('site-preview:change-site', (event, change: SiteChange) => {
    if (getPreview(event)) return siteStore.change(change)
  })
}
