import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { ElectronAPI } from '@electron-toolkit/preload'
import type { AppAPI } from '@shared/api'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: AppAPI = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximizedChanged: (callback) => subscribe('window:maximized-changed', callback)
  },
  sitePreview: {
    show: (request) => ipcRenderer.invoke('site-preview:show', request),
    hide: () => ipcRenderer.invoke('site-preview:hide'),
    pin: (pinned) => ipcRenderer.invoke('site-preview:pin', pinned),
    command: (command) => ipcRenderer.invoke('site-preview:command', command),
    listSites: () => ipcRenderer.invoke('site-preview:list-sites'),
    changeSite: (change) => ipcRenderer.invoke('site-preview:change-site', change),
    onState: (callback) => subscribe('site-preview:state', callback)
  },
  prefs: {
    get: () => ipcRenderer.invoke('prefs:get'),
    patch: (patch) => ipcRenderer.invoke('prefs:patch', patch)
  },
  app: {
    version: () => ipcRenderer.invoke('app:version'),
    dataDir: () => ipcRenderer.invoke('app:data-dir'),
    openDataDir: () => ipcRenderer.invoke('app:open-data-dir'),
    hideToTray: () => ipcRenderer.invoke('app:hide-to-tray'),
    quit: () => ipcRenderer.invoke('app:quit')
  },
  shortcuts: {
    apply: (bossKey, hideKey, summonKey) => ipcRenderer.invoke('shortcuts:apply', bossKey, hideKey, summonKey)
  },
  onToggleBoss: (callback) => subscribe('moyu:toggle-boss', callback),
  onToggleSearch: (callback) => subscribe('global:toggle-search', callback)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', {} as ElectronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = {} as ElectronAPI
  // @ts-ignore
  window.api = api
}
