import { app, ipcMain, shell } from 'electron'
import type { PreferencesPatch } from '@shared/preferences'
import { preferenceStore } from '../services/preferenceStore'
import { shortcutService } from '../services/shortcutService'
import { windowService } from '../services/windowService'
import { lifecycle } from '../services/lifecycle'
import { isTrustedSender } from './guard'

export function registerPreferencesIpc(): void {
  ipcMain.handle('prefs:get', () => preferenceStore.get())

  ipcMain.handle('prefs:patch', (_event, patch: PreferencesPatch) => {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return preferenceStore.get()
    return preferenceStore.patch(patch)
  })

  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:data-dir', () => app.getPath('userData'))

  ipcMain.handle('app:open-data-dir', async (event) => {
    if (!isTrustedSender(event)) return
    await shell.openPath(app.getPath('userData'))
  })

  ipcMain.handle('app:hide-to-tray', (event) => {
    if (!isTrustedSender(event)) return
    windowService.getMainWindow()?.hide()
  })

  ipcMain.handle('app:quit', (event) => {
    if (!isTrustedSender(event)) return
    lifecycle.quit()
  })

  ipcMain.handle('shortcuts:apply', async (event, bossKey: unknown, summonKey: unknown) => {
    if (!isTrustedSender(event)) return { ok: false, error: '来源不可信' }
    const keys = {
      bossKey: typeof bossKey === 'string' ? bossKey : '',
      summonKey: typeof summonKey === 'string' ? summonKey : ''
    }
    const result = shortcutService.apply(keys)
    if (result.ok) await preferenceStore.patch({ settings: keys })
    return result
  })
}
