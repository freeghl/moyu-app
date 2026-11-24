import { BrowserWindow, Menu, ipcMain, type MenuItemConstructorOptions } from 'electron'
import { windowService } from '../services/windowService'
import { isTrustedSender } from './guard'

export function registerWindowIpc(): void {
  ipcMain.handle('window:minimize', (event) => {
    if (!isTrustedSender(event)) return
    windowService.minimize()
  })
  ipcMain.handle('window:maximize', (event) => {
    if (!isTrustedSender(event)) return
    windowService.maximize()
  })
  ipcMain.handle('window:close', (event) => {
    if (!isTrustedSender(event)) return
    windowService.close()
  })
  ipcMain.handle('window:isMaximized', () => windowService.isMaximized())
}

/** 无边框窗口没有系统菜单，需要自己补上输入框的右键菜单（复制 / 粘贴 / 全选等） */
function attachContextMenu(window: BrowserWindow): void {
  window.webContents.on('context-menu', (_event, params) => {
    const items: MenuItemConstructorOptions[] = []

    if (params.isEditable) {
      items.push(
        { label: '撤销', role: 'undo', enabled: params.editFlags.canUndo },
        { label: '重做', role: 'redo', enabled: params.editFlags.canRedo },
        { type: 'separator' },
        { label: '剪切', role: 'cut', enabled: params.editFlags.canCut },
        { label: '复制', role: 'copy', enabled: params.editFlags.canCopy },
        { label: '粘贴', role: 'paste', enabled: params.editFlags.canPaste },
        { type: 'separator' },
        { label: '全选', role: 'selectAll', enabled: params.editFlags.canSelectAll }
      )
    } else if (params.selectionText.trim()) {
      items.push({ label: '复制', role: 'copy' })
    }

    if (!items.length) return
    Menu.buildFromTemplate(items).popup({ window })
  })
}

export function setupWindowEvents(window: BrowserWindow): void {
  window.on('maximize', () => {
    window.webContents.send('window:maximized-changed', true)
  })
  window.on('unmaximize', () => {
    window.webContents.send('window:maximized-changed', false)
  })
  attachContextMenu(window)
}
