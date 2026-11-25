import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '@electron-toolkit/preload'
import type { BackgroundImage } from '@shared/types'
import type { ProcessSnapshot, SystemMetrics, SystemSnapshot } from '@shared/system'

const api = {
  system: {
    getSnapshot: (): Promise<SystemSnapshot> => ipcRenderer.invoke('system:getSnapshot'),
    getMetrics: (): Promise<SystemMetrics> => ipcRenderer.invoke('system:getMetrics'),
    getProcesses: (): Promise<ProcessSnapshot> => ipcRenderer.invoke('system:getProcesses')
  },
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    maximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    onMaximizedChanged: (callback: (isMaximized: boolean) => void): void => {
      ipcRenderer.on('window:maximized-changed', (_, isMaximized) => callback(isMaximized))
    }
  },
  background: {
    select: (): Promise<BackgroundImage | null> => ipcRenderer.invoke('background:select'),
    load: (fileName: string): Promise<BackgroundImage | null> => ipcRenderer.invoke('background:load', fileName),
    remove: (fileName: string): Promise<void> => ipcRenderer.invoke('background:remove', fileName)
  },
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
