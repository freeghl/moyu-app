import { app, BrowserWindow, screen, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import type { AppPreferences, WindowState } from '@shared/preferences'
import { windowService } from './services/windowService'
import { hideSitePreview, registerAllIpc, setupSitePreview, setupTimeCoachEvents, setupWindowEvents } from './ipc'
import { preferenceStore } from './services/preferenceStore'
import { createTray, destroyTray, updateTray, type TrayHandlers } from './services/trayService'
import { shortcutService } from './services/shortcutService'
import { lifecycle } from './services/lifecycle'
import { resourcePath } from './services/assetPath'
import { activityTrackerService } from './services/time-coach/activityTrackerService'
import { hoverVideoService } from './services/hoverVideoService'

let preferences: AppPreferences
let resizing: ReturnType<typeof setTimeout> | undefined

function allowsAppNavigation(value: string): boolean {
  try {
    return ['http:', 'https:', 'file:', 'about:', 'data:', 'blob:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

function guardExternalProtocols(): void {
  app.on('web-contents-created', (_event, contents) => {
    const preventExternalNavigation = (event: Electron.Event, url: string): void => {
      if (allowsAppNavigation(url)) return
      event.preventDefault()
      console.warn('[moyu] 已拦截不支持的外部链接：', url)
    }
    contents.on('will-navigate', preventExternalNavigation)
    contents.on('will-frame-navigate', (event) => {
      if (allowsAppNavigation(event.url)) return
      event.preventDefault()
      console.warn('[moyu] 已拦截不支持的外部链接：', event.url)
    })
  })
}

function overlapsVisibleScreen(state: WindowState): boolean {
  if (state.x === undefined || state.y === undefined) return false
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea
    const overlapX = Math.min(state.x! + state.width, area.x + area.width) - Math.max(state.x!, area.x)
    const overlapY = Math.min(state.y! + state.height, area.y + area.height) - Math.max(state.y!, area.y)
    return overlapX >= 200 && overlapY >= 120
  })
}

function windowOptions(state: WindowState): Electron.BrowserWindowConstructorOptions {
  return {
    ...(overlapsVisibleScreen(state) ? { x: state.x, y: state.y } : {}),
    width: state.width,
    height: state.height,
    minWidth: 960,
    minHeight: 640,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    title: 'Visual Studio Code',
    backgroundColor: '#090a0d',
    icon: resourcePath('icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  }
}

function saveWindowState(window: BrowserWindow, sync = false): void {
  if (window.isDestroyed()) return
  const bounds = window.getNormalBounds()
  const state: WindowState = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    maximized: window.isMaximized()
  }
  if (sync) {
    preferenceStore.patchSync({ window: state })
    return
  }
  clearTimeout(resizing)
  resizing = setTimeout(() => {
    void preferenceStore.patch({ window: state }).catch(() => undefined)
  }, 400)
}

function showWindow(): void {
  const window = windowService.getMainWindow()
  if (!window || window.isDestroyed()) return
  hoverVideoService.hide()
  if (!window.isVisible()) window.show()
  window.focus()
  syncTray()
}

function hideWindow(): void {
  const window = windowService.getMainWindow()
  if (!window || window.isDestroyed()) return
  hideSitePreview(window)
  hoverVideoService.hide()
  window.hide()
  syncTray()
}

function toggleBoss(): void {
  const window = windowService.getMainWindow()
  if (!window || window.isDestroyed()) return
  hideSitePreview(window)
  hoverVideoService.hide()
  if (!window.isVisible()) window.show()
  window.focus()
  window.webContents.send('moyu:toggle-boss')
  syncTray()
}

function toggleHide(): void {
  const window = windowService.getMainWindow()
  if (!window || window.isDestroyed()) return
  if (window.isVisible() && window.isFocused()) {
    hideWindow()
  } else {
    showWindow()
  }
}

function summon(): void {
  const window = windowService.getMainWindow()
  if (!window || window.isDestroyed()) return
  hideSitePreview(window)
  hoverVideoService.hide()
  if (!window.isVisible()) window.show()
  window.focus()
  window.webContents.send('global:toggle-search')
  syncTray()
}

const trayHandlers: TrayHandlers = {
  show: () => showWindow(),
  hide: () => hideWindow(),
  quit: () => lifecycle.quit()
}

function syncTray(): void {
  const window = windowService.getMainWindow()
  updateTray(
    {
      windowVisible: Boolean(window && !window.isDestroyed() && window.isVisible()),
      bossKey: preferences.settings.bossKey,
      hideKey: preferences.settings.hideKey,
      summonKey: preferences.settings.summonKey
    },
    trayHandlers
  )
}

function createWindow(state: WindowState): void {
  const mainWindow = new BrowserWindow(windowOptions(state))

  windowService.setMainWindow(mainWindow)
  hoverVideoService.attach(mainWindow)
  setupWindowEvents(mainWindow)
  setupSitePreview(mainWindow)
  setupTimeCoachEvents(mainWindow)

  mainWindow.once('ready-to-show', () => {
    if (state.maximized) mainWindow.maximize()
    mainWindow.show()
    syncTray()
  })

  mainWindow.on('show', () => syncTray())
  mainWindow.on('hide', () => syncTray())
  mainWindow.on('resize', () => saveWindowState(mainWindow))
  mainWindow.on('move', () => saveWindowState(mainWindow))
  mainWindow.on('maximize', () => saveWindowState(mainWindow))
  mainWindow.on('unmaximize', () => saveWindowState(mainWindow))
  mainWindow.on('close', (event) => {
    saveWindowState(mainWindow, true)
    if (preferences.settings.closeToTray && !lifecycle.isQuitting()) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (/^https?:\/\//i.test(details.url)) void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const locked = app.requestSingleInstanceLock()
if (!locked) {
  app.quit()
} else {
  app.on('second-instance', () => showWindow())

  app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.moyu.app')
    guardExternalProtocols()

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    preferences = await preferenceStore.get()

    registerAllIpc()
    await activityTrackerService.init()
    shortcutService.setHandlers({
      toggleBoss,
      toggleHide,
      summon,
      previousVideo: () => { void hoverVideoService.switchVideo(-1) },
      nextVideo: () => { void hoverVideoService.switchVideo(1) }
    })
    const shortcutResult = shortcutService.apply(preferences.settings)
    if (!shortcutResult.ok) console.warn('[moyu] 全局快捷键注册失败：', shortcutResult.error)
    preferenceStore.subscribe((next) => {
      preferences = next
      hoverVideoService.applyPreferences(next.hoverVideo)
      syncTray()
    })

    createTray(trayHandlers, {
      windowVisible: false,
      bossKey: preferences.settings.bossKey,
      hideKey: preferences.settings.hideKey,
      summonKey: preferences.settings.summonKey
    })

    hoverVideoService.applyPreferences(preferences.hoverVideo)
    createWindow(preferences.window)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(preferences.window)
      else showWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  lifecycle.markQuitting()
  activityTrackerService.disposeSync()
  hoverVideoService.dispose()
  shortcutService.dispose()
  destroyTray()
})

app.on('will-quit', () => {
  shortcutService.dispose()
  destroyTray()
})
