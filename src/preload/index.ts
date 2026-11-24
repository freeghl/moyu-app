import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '@electron-toolkit/preload'
import type { MoyuPreviewAPI } from '@shared/moyuPreview'

const api = {
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    maximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    onMaximizedChanged: (callback: (isMaximized: boolean) => void): void => {
      ipcRenderer.on('window:maximized-changed', (_, isMaximized) => callback(isMaximized))
    }
  },
  moyuPreview: {
    show: (request) => ipcRenderer.invoke('moyu-preview:show', request),
    hide: () => ipcRenderer.invoke('moyu-preview:hide'),
    listSites: () => ipcRenderer.invoke('moyu-preview:list-sites'),
    changeSite: (change) => ipcRenderer.invoke('moyu-preview:change-site', change)
  } satisfies MoyuPreviewAPI,
  onToggleSearch: (callback: () => void): void => {
    ipcRenderer.on('global:toggle-search', () => callback())
  }
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
