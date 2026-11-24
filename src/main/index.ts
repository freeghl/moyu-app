import { app, BrowserWindow, globalShortcut, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { windowService } from './services/windowService'
import { hideMoyuPreview, registerAllIpc, setupMoyuPreview, setupWindowEvents } from './ipc'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#090a0d',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  windowService.setMainWindow(mainWindow)
  setupWindowEvents(mainWindow)
  setupMoyuPreview(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.moyu.toolbox')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerAllIpc()
  createWindow()

  // Global shortcut: Ctrl+K or Cmd+K
  globalShortcut.register('CommandOrControl+K', () => {
    const mainWindow = windowService.getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) return
    hideMoyuPreview(mainWindow)
    mainWindow.webContents.send('global:toggle-search')
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
