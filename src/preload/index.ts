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
    apply: (bossKey, hideKey, summonKey, videoPreviousKey, videoNextKey) => ipcRenderer.invoke(
      'shortcuts:apply',
      bossKey,
      hideKey,
      summonKey,
      videoPreviousKey,
      videoNextKey
    )
  },
  background: {
    select: () => ipcRenderer.invoke('background:select'),
    load: (fileName) => ipcRenderer.invoke('background:load', fileName),
    remove: (fileName) => ipcRenderer.invoke('background:remove', fileName)
  },
  system: {
    getSnapshot: () => ipcRenderer.invoke('system:getSnapshot'),
    getMetrics: () => ipcRenderer.invoke('system:getMetrics'),
    getProcesses: () => ipcRenderer.invoke('system:getProcesses'),
    killProcess: (pid) => ipcRenderer.invoke('system:killProcess', pid)
  },
  ai: {
    getConfig: () => ipcRenderer.invoke('ai:get-config'),
    saveProfile: (input) => ipcRenderer.invoke('ai:save-profile', input),
    deleteProfile: (id) => ipcRenderer.invoke('ai:delete-profile', id),
    setDefault: (id) => ipcRenderer.invoke('ai:set-default', id),
    testConnection: (input) => ipcRenderer.invoke('ai:test-connection', input),
    listModels: (input) => ipcRenderer.invoke('ai:list-models', input),
    chat: (request) => ipcRenderer.invoke('ai:chat', request),
    chatStream: (request) => ipcRenderer.invoke('ai:chat-stream', request),
    abort: (requestId) => ipcRenderer.invoke('ai:abort', requestId),
    onStreamChunk: (callback) => subscribe('ai:stream-chunk', callback)
  },
  timeCoach: {
    getStatus: () => ipcRenderer.invoke('time-coach:get-status'),
    start: () => ipcRenderer.invoke('time-coach:start'),
    pause: () => ipcRenderer.invoke('time-coach:pause'),
    resume: () => ipcRenderer.invoke('time-coach:resume'),
    stop: () => ipcRenderer.invoke('time-coach:stop'),
    dismissBreakReminder: () => ipcRenderer.invoke('time-coach:dismiss-break'),
    getDailySummary: (date) => ipcRenderer.invoke('time-coach:get-daily-summary', date),
    getTrends: (days) => ipcRenderer.invoke('time-coach:get-trends', days),
    getSettings: () => ipcRenderer.invoke('time-coach:get-settings'),
    updateSettings: (patch) => ipcRenderer.invoke('time-coach:update-settings', patch),
    listRules: () => ipcRenderer.invoke('time-coach:list-rules'),
    saveRule: (input) => ipcRenderer.invoke('time-coach:save-rule', input),
    deleteRule: (id) => ipcRenderer.invoke('time-coach:delete-rule', id),
    reclassify: (req) => ipcRenderer.invoke('time-coach:reclassify', req),
    getDailyNote: (date) => ipcRenderer.invoke('time-coach:get-daily-note', date),
    saveDailyNote: (note) => ipcRenderer.invoke('time-coach:save-daily-note', note),
    buildAiDigest: (date, days) => ipcRenderer.invoke('time-coach:build-ai-digest', date, days),
    clearHistory: (date) => ipcRenderer.invoke('time-coach:clear-history', date),
    onStatusChanged: (callback) => subscribe('time-coach:status-changed', callback)
  },
  hoverVideo: {
    openLogin: (source) => ipcRenderer.invoke('hover-video:open-login', source),
    finishLogin: (source) => ipcRenderer.invoke('hover-video:finish-login', source),
    captureHotspot: () => ipcRenderer.invoke('hover-video:capture-hotspot'),
    removeHotspot: (id) => ipcRenderer.invoke('hover-video:remove-hotspot', id),
    onState: (callback) => subscribe('hover-video:state', callback)
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
