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
  moyuPreview: {
    show: (request) => ipcRenderer.invoke('moyu-preview:show', request),
    hide: () => ipcRenderer.invoke('moyu-preview:hide'),
    pin: (pinned) => ipcRenderer.invoke('moyu-preview:pin', pinned),
    command: (command) => ipcRenderer.invoke('moyu-preview:command', command),
    listSites: () => ipcRenderer.invoke('moyu-preview:list-sites'),
    changeSite: (change) => ipcRenderer.invoke('moyu-preview:change-site', change),
    onState: (callback) => subscribe('moyu-preview:state', callback)
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
    apply: (bossKey, summonKey) => ipcRenderer.invoke('shortcuts:apply', bossKey, summonKey)
  },
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
