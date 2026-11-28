import { BrowserWindow, powerMonitor, screen, session } from 'electron'
import type { Session, WebContents } from 'electron'
import { randomInt, randomUUID } from 'node:crypto'
import {
  HOVER_VIDEO_HEIGHT,
  HOVER_VIDEO_HOTSPOT_SIZE,
  HOVER_VIDEO_SOURCE_IDS,
  HOVER_VIDEO_WIDTH,
  isHoverVideoSourceId,
  type HoverVideoHotspot,
  type HoverVideoPreferences,
  type HoverVideoSourceId,
  type HoverVideoState,
  type HoverVideoStatus
} from '@shared/hoverVideo'
import { createDefaultPreferences } from '@shared/preferences'
import { isCursorOnDesktop } from './desktopWindow'
import { HOVER_VIDEO_SOURCES } from './hoverVideoSources'
import { shortcutService } from './shortcutService'

const CURSOR_INTERVAL = 32
const ENTER_DELAY = 220
const LEAVE_DELAY = 140
const CAPTURE_DELAY = 1400
const PRELOAD_DELAY = 2500
const OVERLAY_STATE_CHANNEL = 'hover-video:state'

interface PlaybackResult {
  playing: boolean
  pendingNavigation?: boolean
}

interface VideoTarget {
  url: string
  previousUrl?: string
}

interface PreloadedVideo {
  overlay: BrowserWindow
  sourceId: HoverVideoSourceId
  direction: -1 | 1
  url: string
}

function contains(hotspot: HoverVideoHotspot, point: Electron.Point): boolean {
  return point.x >= hotspot.x
    && point.x <= hotspot.x + hotspot.width
    && point.y >= hotspot.y
    && point.y <= hotspot.y + hotspot.height
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

class HoverVideoService {
  private preferences: HoverVideoPreferences = createDefaultPreferences().hoverVideo
  private mainWindow: BrowserWindow | null = null
  private overlays = new Map<HoverVideoSourceId, BrowserWindow>()
  private watchedOverlays = new WeakSet<BrowserWindow>()
  private prewarming = new Set<HoverVideoSourceId>()
  private loginWindows = new Map<HoverVideoSourceId, BrowserWindow>()
  private sessions = new Map<HoverVideoSourceId, Session>()
  private activeOverlay: BrowserWindow | null = null
  private activeSource?: HoverVideoSourceId
  private preloadedPrevious?: PreloadedVideo
  private preloadedNext?: PreloadedVideo
  private preloadToken = 0
  private switching = false
  private lastSource?: HoverVideoSourceId
  private cursorTimer: ReturnType<typeof setInterval> | undefined
  private enterTimer: ReturnType<typeof setTimeout> | undefined
  private leaveTimer: ReturnType<typeof setTimeout> | undefined
  private activeHotspotId?: string
  private activationId = 0
  private status: HoverVideoStatus = 'hidden'
  private capturing = false
  private loginStates: Record<HoverVideoSourceId, boolean> = {
    tiktok: false,
    douyin: false,
    bilibili: false
  }
  private notice?: string

  private readonly handleDisplayChange = (): void => this.hide()
  private readonly handleLockScreen = (): void => this.hide()

  attach(mainWindow: BrowserWindow): void {
    if (this.mainWindow === mainWindow) return
    this.detach()
    this.mainWindow = mainWindow
    mainWindow.once('closed', () => {
      if (this.mainWindow === mainWindow) this.detach()
    })
    screen.on('display-metrics-changed', this.handleDisplayChange)
    powerMonitor.on('lock-screen', this.handleLockScreen)
    void this.refreshLoginState()
    this.applyPreferences(this.preferences)
  }

  detach(): void {
    this.stopPolling()
    this.hide()
    this.mainWindow = null
    screen.off('display-metrics-changed', this.handleDisplayChange)
    powerMonitor.off('lock-screen', this.handleLockScreen)
    for (const loginWindow of this.loginWindows.values()) {
      if (!loginWindow.isDestroyed()) loginWindow.destroy()
    }
    this.loginWindows.clear()
    this.clearPreloaded()
    for (const overlay of this.overlays.values()) {
      if (!overlay.isDestroyed()) overlay.destroy()
    }
    this.overlays.clear()
    this.activeOverlay = null
    this.activeSource = undefined
  }

  applyPreferences(next: HoverVideoPreferences): void {
    const previous = this.preferences
    this.preferences = next

    if (!next.enabled || !next.hotspots.length || !next.sources.length) {
      this.hide()
      this.stopPolling()
      return
    }

    if (this.activeHotspotId && !next.hotspots.some((hotspot) => hotspot.id === this.activeHotspotId)) {
      this.hide()
    }
    if (this.activeSource && !next.sources.includes(this.activeSource)) this.hide()

    if (previous.muted !== next.muted) {
      for (const overlay of this.overlays.values()) {
        if (!overlay.isDestroyed()) {
          void overlay.webContents.executeJavaScript(
            `window.__moyuHoverVideo?.setMuted(${JSON.stringify(next.muted)})`
          ).catch(() => undefined)
        }
      }
    }

    this.syncPolling()
    this.prewarmSources(next.sources)
  }

  private prewarmSources(sources: HoverVideoSourceId[]): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    for (const sourceId of sources) void this.prewarmSource(sourceId)
  }

  private async prewarmSource(sourceId: HoverVideoSourceId): Promise<void> {
    if (this.prewarming.has(sourceId)) return
    const existing = this.overlays.get(sourceId)
    if (existing && !existing.isDestroyed()) return

    this.prewarming.add(sourceId)
    try {
      const overlay = await this.ensureOverlay(sourceId)
      await this.installPlayer(overlay, sourceId)
    } catch {
      return
    } finally {
      this.prewarming.delete(sourceId)
    }
  }

  getState(): HoverVideoState {
    return {
      status: this.status,
      activeSource: this.activeSource,
      loginStates: { ...this.loginStates },
      capturing: this.capturing,
      notice: this.notice
    }
  }

  async openLogin(sourceId: HoverVideoSourceId): Promise<void> {
    if (!isHoverVideoSourceId(sourceId)) throw new Error('不支持的视频来源。')
    const existing = this.loginWindows.get(sourceId)
    if (existing && !existing.isDestroyed()) {
      existing.show()
      existing.focus()
      return
    }

    const definition = HOVER_VIDEO_SOURCES[sourceId]
    const loginWindow = new BrowserWindow({
      width: 520,
      height: 760,
      show: false,
      title: `登录 ${definition.name}`,
      autoHideMenuBar: true,
      webPreferences: {
        partition: definition.partition,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false
      }
    })
    this.loginWindows.set(sourceId, loginWindow)
    this.notice = `请在弹出窗口完成 ${definition.name} 登录，然后点击“已完成登录”。`
    this.emitState()
    const guardLoginNavigation = (contents: WebContents): void => {
      const allowsUrl = (url: string): boolean => /^https:\/\//i.test(url)
      contents.setWindowOpenHandler(({ url }) => allowsUrl(url)
        ? { action: 'allow' }
        : { action: 'deny' })
      contents.on('will-frame-navigate', (event) => {
        if (!allowsUrl(event.url)) event.preventDefault()
      })
      contents.on('will-redirect', (event) => {
        if (!allowsUrl(event.url)) event.preventDefault()
      })
      contents.on('did-create-window', (window) => guardLoginNavigation(window.webContents))
    }
    guardLoginNavigation(loginWindow.webContents)
    loginWindow.once('closed', () => {
      if (this.loginWindows.get(sourceId) === loginWindow) this.loginWindows.delete(sourceId)
      void this.refreshLoginState(sourceId)
    })

    try {
      await loginWindow.loadURL(definition.loginUrl)
      loginWindow.show()
      loginWindow.focus()
    } catch (error) {
      this.notice = error instanceof Error ? error.message : `${definition.name} 登录窗口加载失败。`
      this.emitState()
    }
  }

  async finishLogin(sourceId: HoverVideoSourceId): Promise<void> {
    if (!isHoverVideoSourceId(sourceId)) throw new Error('不支持的视频来源。')
    const loginWindow = this.loginWindows.get(sourceId)
    if (loginWindow && !loginWindow.isDestroyed()) loginWindow.close()
    await this.refreshLoginState(sourceId)

    const overlay = this.overlays.get(sourceId)
    if (overlay && !overlay.isDestroyed()) {
      this.hide()
      try {
        await overlay.webContents.reload()
      } catch {
        // 下次触发时会重新加载推荐页
      }
    }

    const definition = HOVER_VIDEO_SOURCES[sourceId]
    this.notice = this.loginStates[sourceId]
      ? `${definition.name} 登录已保存，将优先读取你的个性化推荐。`
      : `尚未检测到 ${definition.name} 登录状态，可继续播放公开推荐或重新登录。`
    this.emitState()
  }

  async captureHotspot(): Promise<HoverVideoHotspot> {
    const mainWindow = this.mainWindow
    if (!mainWindow || mainWindow.isDestroyed()) throw new Error('应用窗口不可用，无法记录热区。')
    if (this.capturing) throw new Error('正在记录热区，请稍候。')

    this.hide()
    this.capturing = true
    this.notice = '设置窗口即将最小化，请把鼠标移到要触发的桌面图标上。'
    this.emitState()
    mainWindow.minimize()

    try {
      await new Promise<void>((resolve) => setTimeout(resolve, CAPTURE_DELAY))
      const cursor = screen.getCursorScreenPoint()
      const display = screen.getDisplayNearestPoint(cursor)
      const area = display.workArea
      const size = HOVER_VIDEO_HOTSPOT_SIZE
      const x = clamp(Math.round(cursor.x - size / 2), area.x + 4, Math.max(area.x + 4, area.x + area.width - size - 4))
      const y = clamp(Math.round(cursor.y - size / 2), area.y + 4, Math.max(area.y + 4, area.y + area.height - size - 4))
      const hotspot: HoverVideoHotspot = {
        id: randomUUID(),
        name: `桌面热区 ${this.preferences.hotspots.length + 1}`,
        x,
        y,
        width: size,
        height: size,
        displayId: display.id
      }
      this.notice = `已记录${hotspot.name}，回到应用后可继续添加。`
      return hotspot
    } catch (error) {
      this.notice = error instanceof Error ? error.message : '记录热区失败，请重试。'
      throw error
    } finally {
      this.capturing = false
      if (!mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.show()
        mainWindow.focus()
      }
      this.emitState()
      this.syncPolling()
    }
  }

  removeHotspot(id: string): void {
    if (this.activeHotspotId === id) this.hide()
  }

  async switchVideo(direction: -1 | 1): Promise<void> {
    if (this.switching) return
    const overlay = this.activeOverlay
    const sourceId = this.activeSource
    if (!overlay || overlay.isDestroyed() || !sourceId || this.status !== 'playing') return

    const preloaded = direction < 0 ? this.preloadedPrevious : this.preloadedNext
    if (preloaded?.sourceId === sourceId && !preloaded.overlay.isDestroyed()) {
      this.switching = true
      try {
        await this.activatePreloaded(preloaded, direction)
      } finally {
        this.switching = false
      }
      return
    }

    try {
      await overlay.webContents.executeJavaScript(
        `window.__moyuHoverVideo?.wheel(${direction})`
      )
    } catch (error) {
      this.notice = error instanceof Error ? error.message : '切换视频失败，请重试。'
      this.emitState()
    }
  }

  private async activatePreloaded(preloaded: PreloadedVideo, direction: -1 | 1): Promise<void> {
    const previousOverlay = this.activeOverlay
    if (!previousOverlay || previousOverlay === preloaded.overlay) return

    const sourceId = preloaded.sourceId
    const activationId = this.activationId
    const previousUrl = previousOverlay.webContents.getURL()
    const hotspot = this.preferences.hotspots.find((item) => item.id === this.activeHotspotId)
    const obsolete = direction < 0 ? this.preloadedNext : this.preloadedPrevious
    this.preloadToken++
    if (direction < 0) {
      this.preloadedPrevious = undefined
      this.preloadedNext = undefined
    } else {
      this.preloadedNext = undefined
      this.preloadedPrevious = undefined
    }
    if (obsolete && !obsolete.overlay.isDestroyed()) obsolete.overlay.destroy()

    void previousOverlay.webContents.executeJavaScript('window.__moyuHoverVideo?.pause()').catch(() => undefined)
    previousOverlay.setIgnoreMouseEvents(true, { forward: true })
    previousOverlay.hide()

    this.activeOverlay = preloaded.overlay
    this.activeSource = sourceId
    this.overlays.set(sourceId, preloaded.overlay)
    this.watchActiveOverlay(preloaded.overlay, sourceId)
    if (direction < 0) {
      this.preloadedNext = { overlay: previousOverlay, sourceId, direction: 1, url: previousUrl }
    } else {
      this.preloadedPrevious = { overlay: previousOverlay, sourceId, direction: -1, url: previousUrl }
    }

    if (hotspot) this.positionOverlay(preloaded.overlay, hotspot)
    preloaded.overlay.setIgnoreMouseEvents(true, { forward: true })
    preloaded.overlay.showInactive()
    shortcutService.setHoverVideoActive(false)

    try {
      const result = await preloaded.overlay.webContents.executeJavaScript(
        `window.__moyuHoverVideo?.play(${JSON.stringify({ muted: this.preferences.muted })})`
      ) as PlaybackResult | undefined
      if (activationId !== this.activationId || this.activeOverlay !== preloaded.overlay) {
        await preloaded.overlay.webContents.executeJavaScript('window.__moyuHoverVideo?.pause()').catch(() => undefined)
        return
      }
      if (!result?.playing) throw new Error('预加载视频播放失败。')
      this.status = 'playing'
      const shortcutResult = shortcutService.setHoverVideoActive(true)
      this.notice = shortcutResult.ok ? undefined : `视频切换快捷键注册失败：${shortcutResult.error}`
      this.emitState()
      void this.preloadAdjacent(sourceId)
    } catch (error) {
      if (activationId !== this.activationId || this.activeOverlay !== preloaded.overlay) return
      this.status = 'error'
      this.notice = error instanceof Error ? error.message : '预加载视频播放失败。'
      this.emitState()
    }
  }

  private async preloadAdjacent(sourceId: HoverVideoSourceId): Promise<void> {
    const overlay = this.activeOverlay
    if (!overlay || overlay.isDestroyed() || sourceId === 'tiktok' || this.status !== 'playing') return
    if (this.preloadedNext && !this.preloadedNext.overlay.isDestroyed()) return
    const token = ++this.preloadToken

    await new Promise((resolve) => setTimeout(resolve, PRELOAD_DELAY))
    if (token !== this.preloadToken || this.activeOverlay !== overlay || this.status !== 'playing') return

    if (this.preloadedPrevious && !this.preloadedPrevious.overlay.isDestroyed()) {
      this.preloadedPrevious.overlay.destroy()
    }
    this.preloadedPrevious = undefined

    try {
      const target = await overlay.webContents.executeJavaScript(
        'window.__moyuHoverVideo?.target(1)'
      ) as VideoTarget | null | undefined
      if (!target?.url || token !== this.preloadToken || this.activeOverlay !== overlay) return
      await this.preloadVideo(sourceId, 1, target, token)
    } catch {
      return
    }
  }

  private async preloadVideo(
    sourceId: HoverVideoSourceId,
    direction: -1 | 1,
    target: VideoTarget,
    token: number
  ): Promise<void> {
    const overlay = this.createOverlay(sourceId)
    const isCurrent = (): boolean => token === this.preloadToken
      && this.activeSource === sourceId
      && this.status === 'playing'

    try {
      await overlay.loadURL(target.url)
      if (!isCurrent() || overlay.isDestroyed()) {
        if (!overlay.isDestroyed()) overlay.destroy()
        return
      }
      await this.installPlayer(overlay, sourceId)
      if (!isCurrent() || overlay.isDestroyed()) {
        if (!overlay.isDestroyed()) overlay.destroy()
        return
      }
      if (target.previousUrl) {
        await overlay.webContents.executeJavaScript(
          `window.__moyuHoverVideo?.remember(${JSON.stringify(target.previousUrl)})`
        )
      }
      const result = await overlay.webContents.executeJavaScript(
        'window.__moyuHoverVideo?.prepare()'
      ) as { ready?: boolean } | undefined
      if (!isCurrent() || !result?.ready || overlay.isDestroyed()) {
        if (!overlay.isDestroyed()) overlay.destroy()
        return
      }
      overlay.setIgnoreMouseEvents(true, { forward: true })
      const preloaded = { overlay, sourceId, direction, url: target.url }
      if (direction < 0) this.preloadedPrevious = preloaded
      else this.preloadedNext = preloaded
    } catch {
      if (!overlay.isDestroyed()) overlay.destroy()
    }
  }

  private clearPreloaded(): void {
    this.preloadToken++
    const preloaded = [this.preloadedPrevious, this.preloadedNext]
    this.preloadedPrevious = undefined
    this.preloadedNext = undefined
    for (const item of preloaded) {
      if (item && !item.overlay.isDestroyed()) item.overlay.destroy()
    }
  }

  hide(): void {
    this.activationId++
    this.clearHoverTimers()
    this.activeHotspotId = undefined
    this.status = 'hidden'
    shortcutService.setHoverVideoActive(false)
    this.clearPreloaded()
    for (const overlay of this.overlays.values()) {
      if (overlay.isDestroyed()) continue
      void overlay.webContents.executeJavaScript('window.__moyuHoverVideo?.pause()').catch(() => undefined)
      overlay.setIgnoreMouseEvents(true, { forward: true })
      overlay.hide()
    }
    this.activeOverlay = null
    this.activeSource = undefined
    this.emitState()
  }

  dispose(): void {
    this.detach()
  }

  private getSession(sourceId: HoverVideoSourceId): Session {
    let sourceSession = this.sessions.get(sourceId)
    if (!sourceSession) {
      sourceSession = session.fromPartition(HOVER_VIDEO_SOURCES[sourceId].partition)
      this.sessions.set(sourceId, sourceSession)
    }
    return sourceSession
  }

  private async refreshLoginState(sourceId?: HoverVideoSourceId): Promise<void> {
    const ids = sourceId ? [sourceId] : [...HOVER_VIDEO_SOURCE_IDS]
    await Promise.all(ids.map(async (id) => {
      try {
        const definition = HOVER_VIDEO_SOURCES[id]
        const cookies = await this.getSession(id).cookies.get({ url: definition.feedUrl })
        this.loginStates[id] = cookies.some((cookie) => definition.loginCookieNames.includes(cookie.name))
      } catch {
        this.loginStates[id] = false
      }
    }))
    this.emitState()
  }

  private canPoll(): boolean {
    return Boolean(
      this.mainWindow
      && !this.mainWindow.isDestroyed()
      && !this.capturing
      && this.preferences.enabled
      && this.preferences.hotspots.length
      && this.preferences.sources.length
    )
  }

  private syncPolling(): void {
    if (!this.canPoll()) {
      this.stopPolling()
      return
    }
    if (this.cursorTimer) return
    this.cursorTimer = setInterval(() => this.pollCursor(), CURSOR_INTERVAL)
    this.cursorTimer.unref()
  }

  private stopPolling(): void {
    if (this.cursorTimer) clearInterval(this.cursorTimer)
    this.cursorTimer = undefined
    this.clearHoverTimers()
  }

  private clearHoverTimers(): void {
    if (this.enterTimer) clearTimeout(this.enterTimer)
    if (this.leaveTimer) clearTimeout(this.leaveTimer)
    this.enterTimer = undefined
    this.leaveTimer = undefined
  }

  private pollCursor(): void {
    if (!this.canPoll()) {
      this.stopPolling()
      return
    }
    if (this.mainWindow?.isFocused()) {
      if (this.activeHotspotId || this.activeOverlay || this.status !== 'hidden') this.hide()
      return
    }

    const cursor = screen.getCursorScreenPoint()
    if (this.activeOverlay && !this.activeOverlay.isDestroyed()) {
      const bounds = this.activeOverlay.getBounds()
      if (cursor.x >= bounds.x && cursor.x <= bounds.x + bounds.width
        && cursor.y >= bounds.y && cursor.y <= bounds.y + bounds.height) {
        if (this.leaveTimer) clearTimeout(this.leaveTimer)
        this.leaveTimer = undefined
        return
      }
    }
    const hotspot = this.preferences.hotspots.find((item) => contains(item, cursor))
    const targeted = Boolean(hotspot && isCursorOnDesktop(cursor))

    if (hotspot && targeted) {
      if (this.activeHotspotId === hotspot.id) return
      if (this.enterTimer) return
      if (this.leaveTimer) clearTimeout(this.leaveTimer)
      this.leaveTimer = undefined
      this.enterTimer = setTimeout(() => {
        this.enterTimer = undefined
        if (!this.isHotspotStillTargeted(hotspot)) return
        void this.activate(hotspot)
      }, ENTER_DELAY)
      return
    }

    if (this.enterTimer) clearTimeout(this.enterTimer)
    this.enterTimer = undefined
    if (!this.activeHotspotId || this.leaveTimer) return
    this.leaveTimer = setTimeout(() => {
      this.leaveTimer = undefined
      this.hide()
    }, LEAVE_DELAY)
  }

  private isHotspotStillTargeted(hotspot: HoverVideoHotspot): boolean {
    if (!this.canPoll() || this.mainWindow?.isFocused()) return false
    const cursor = screen.getCursorScreenPoint()
    return contains(hotspot, cursor) && isCursorOnDesktop(cursor)
  }

  private chooseSource(): HoverVideoSourceId {
    const sources = this.preferences.sources
    if (!sources.length) throw new Error('请至少启用一个视频来源。')
    const alternatives = sources.filter((source) => source !== this.lastSource)
    const pool = alternatives.length ? alternatives : sources
    return pool[randomInt(pool.length)]
  }

  private async activate(hotspot: HoverVideoHotspot): Promise<void> {
    const activationId = ++this.activationId
    this.activeHotspotId = hotspot.id
    this.status = 'loading'
    this.notice = undefined

    try {
      const sourceId = this.chooseSource()
      this.lastSource = sourceId
      this.activeSource = sourceId
      this.emitState()
      const overlay = await this.ensureOverlay(sourceId)
      if (activationId !== this.activationId) return
      this.activateOverlay(overlay)
      this.positionOverlay(overlay, hotspot)
      overlay.hide()
      await this.installPlayer(overlay, sourceId)
      if (activationId !== this.activationId) return
      const result = await overlay.webContents.executeJavaScript(
        `window.__moyuHoverVideo?.play(${JSON.stringify({ muted: this.preferences.muted })})`
      ) as PlaybackResult | undefined
      if (activationId !== this.activationId) return
      this.handlePlaybackResult(overlay, sourceId, result)
    } catch (error) {
      if (activationId !== this.activationId) return
      shortcutService.setHoverVideoActive(false)
      this.status = 'error'
      this.notice = error instanceof Error ? error.message : '推荐视频加载失败。'
      this.emitState()
    }
  }

  private activateOverlay(overlay: BrowserWindow): void {
    for (const candidate of this.overlays.values()) {
      if (candidate === overlay || candidate.isDestroyed()) continue
      void candidate.webContents.executeJavaScript('window.__moyuHoverVideo?.pause()').catch(() => undefined)
      candidate.setIgnoreMouseEvents(true, { forward: true })
      candidate.hide()
    }
    this.activeOverlay = overlay
  }

  private handlePlaybackResult(overlay: BrowserWindow, sourceId: HoverVideoSourceId, result?: PlaybackResult): void {
    if (this.activeOverlay !== overlay) return
    const name = HOVER_VIDEO_SOURCES[sourceId].name
    if (result?.pendingNavigation) {
      shortcutService.setHoverVideoActive(false)
      this.status = 'loading'
      this.notice = `正在打开${name}推荐视频…`
      this.emitState()
      return
    }
    if (!result?.playing) {
      shortcutService.setHoverVideoActive(false)
      overlay.hide()
      throw new Error(`${name} 推荐视频尚未加载，请稍后重试。`)
    }
    this.status = 'playing'
    const shortcutResult = shortcutService.setHoverVideoActive(true)
    this.notice = shortcutResult.ok ? undefined : `视频切换快捷键注册失败：${shortcutResult.error}`
    overlay.setIgnoreMouseEvents(true, { forward: true })
    overlay.showInactive()
    this.emitState()
    void this.preloadAdjacent(sourceId)
  }

  private async resumeAfterNavigation(overlay: BrowserWindow, sourceId: HoverVideoSourceId): Promise<void> {
    if (this.activeOverlay !== overlay || !this.activeHotspotId || overlay.isDestroyed()) return
    const activationId = this.activationId
    try {
      await this.installPlayer(overlay, sourceId)
      if (activationId !== this.activationId || this.activeOverlay !== overlay) return
      const result = await overlay.webContents.executeJavaScript(
        `window.__moyuHoverVideo?.play(${JSON.stringify({ advance: false, muted: this.preferences.muted })})`
      ) as PlaybackResult | undefined
      if (activationId !== this.activationId || this.activeOverlay !== overlay) return
      this.handlePlaybackResult(overlay, sourceId, result)
    } catch (error) {
      if (activationId !== this.activationId || this.activeOverlay !== overlay) return
      shortcutService.setHoverVideoActive(false)
      this.status = 'error'
      this.notice = error instanceof Error ? error.message : '推荐视频加载失败。'
      this.emitState()
    }
  }

  private async installPlayer(overlay: BrowserWindow, sourceId: HoverVideoSourceId): Promise<void> {
    const definition = HOVER_VIDEO_SOURCES[sourceId]
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      if (overlay.isDestroyed()) throw new Error(`${definition.name} 播放窗口已关闭。`)
      try {
        const ready = await overlay.webContents.executeJavaScript(
          'Boolean(document.body && document.readyState !== "loading")'
        )
        if (ready) {
          await overlay.webContents.executeJavaScript(definition.playerScript)
          const installed = await overlay.webContents.executeJavaScript(
            'Boolean(window.__moyuHoverVideo)'
          )
          if (installed) return
        }
      } catch {
        // 页面跳转期间执行上下文会暂时失效
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error(`${definition.name} 推荐页加载超时，请稍后重试。`)
  }

  private createOverlay(sourceId: HoverVideoSourceId): BrowserWindow {
    const definition = HOVER_VIDEO_SOURCES[sourceId]
    const overlay = new BrowserWindow({
      width: HOVER_VIDEO_WIDTH,
      height: HOVER_VIDEO_HEIGHT,
      useContentSize: true,
      show: false,
      frame: false,
      backgroundColor: '#000000',
      hasShadow: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      title: `${definition.name} 推荐`,
      webPreferences: {
        partition: definition.partition,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        autoplayPolicy: 'no-user-gesture-required'
      }
    })
    overlay.setIgnoreMouseEvents(true, { forward: true })
    overlay.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    overlay.webContents.on('will-frame-navigate', (event) => {
      if (!definition.allowsUrl(event.url)) event.preventDefault()
    })
    overlay.webContents.on('will-navigate', (event, url) => {
      if (!definition.allowsUrl(url)) event.preventDefault()
    })
    overlay.webContents.on('will-redirect', (event, url) => {
      if (!definition.allowsUrl(url)) event.preventDefault()
    })
    return overlay
  }

  private watchActiveOverlay(overlay: BrowserWindow, sourceId: HoverVideoSourceId): void {
    if (this.watchedOverlays.has(overlay)) return
    this.watchedOverlays.add(overlay)
    const definition = HOVER_VIDEO_SOURCES[sourceId]
    overlay.webContents.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
      if (!isMainFrame || isInPlace || this.activeOverlay !== overlay) return
      shortcutService.setHoverVideoActive(false)
      overlay.setIgnoreMouseEvents(true, { forward: true })
      this.status = 'loading'
      this.notice = `正在打开${definition.name}推荐视频…`
      this.emitState()
    })
    overlay.webContents.on('did-navigate', () => {
      if (this.activeOverlay === overlay) void this.resumeAfterNavigation(overlay, sourceId)
    })
    overlay.webContents.on('did-fail-load', (_event, errorCode, errorDescription, isMainFrame) => {
      if (!isMainFrame || errorCode === -3 || this.activeOverlay !== overlay) return
      shortcutService.setHoverVideoActive(false)
      this.status = 'error'
      this.notice = `${definition.name} 加载失败：${errorDescription}`
      this.emitState()
    })
    overlay.once('closed', () => {
      if (this.overlays.get(sourceId) === overlay) this.overlays.delete(sourceId)
      if (this.activeOverlay === overlay) {
        shortcutService.setHoverVideoActive(false)
        this.activeOverlay = null
        this.activeHotspotId = undefined
        this.activeSource = undefined
        this.status = 'error'
        this.notice = `${definition.name} 播放窗口已关闭。`
        this.emitState()
      }
    })
  }

  private async ensureOverlay(sourceId: HoverVideoSourceId): Promise<BrowserWindow> {
    const existing = this.overlays.get(sourceId)
    if (existing && !existing.isDestroyed()) return existing

    const definition = HOVER_VIDEO_SOURCES[sourceId]
    const overlay = this.createOverlay(sourceId)
    this.overlays.set(sourceId, overlay)
    this.watchActiveOverlay(overlay, sourceId)

    try {
      await overlay.loadURL(definition.feedUrl)
      return overlay
    } catch (error) {
      if (this.overlays.get(sourceId) === overlay) this.overlays.delete(sourceId)
      overlay.destroy()
      throw error
    }
  }

  private positionOverlay(overlay: BrowserWindow, hotspot: HoverVideoHotspot): void {
    if (overlay.isDestroyed()) return
    const center = {
      x: hotspot.x + hotspot.width / 2,
      y: hotspot.y + hotspot.height / 2
    }
    const area = screen.getDisplayNearestPoint(center).workArea
    const height = Math.min(HOVER_VIDEO_HEIGHT, area.height)
    const width = Math.min(HOVER_VIDEO_WIDTH, Math.round(height * 9 / 16))
    const gap = 12
    let x = hotspot.x + hotspot.width + gap
    if (x + width > area.x + area.width) x = hotspot.x - gap - width
    x = clamp(x, area.x, Math.max(area.x, area.x + area.width - width))
    const y = clamp(Math.round(center.y - height / 2), area.y, Math.max(area.y, area.y + area.height - height))
    overlay.setBounds({ x: Math.round(x), y, width, height })
  }

  private emitState(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    this.mainWindow.webContents.send(OVERLAY_STATE_CHANNEL, this.getState())
  }
}

export const hoverVideoService = new HoverVideoService()
