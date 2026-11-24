import { screen, WebContentsView, type BrowserWindow, type Input, type Point, type Rectangle } from 'electron'
import type { PreviewCommand, PreviewPhase, PreviewRect, SitePreviewRequest, SitePreviewState } from '@shared/sitePreview'

function contains(bounds: Rectangle, point: Point): boolean {
  return point.x >= bounds.x && point.x < bounds.x + bounds.width &&
    point.y >= bounds.y && point.y < bounds.y + bounds.height
}

function toViewBounds(rect: PreviewRect, zoom: number, window: Rectangle): Rectangle | undefined {
  if (![rect?.x, rect?.y, rect?.width, rect?.height].every(Number.isFinite)) return

  const x = Math.round(rect.x * zoom)
  const y = Math.round(rect.y * zoom)
  const width = Math.round((rect.x + rect.width) * zoom) - x
  const height = Math.round((rect.y + rect.height) * zoom) - y
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > window.width || y + height > window.height) return
  return { x, y, width, height }
}

function isHttps(url: string): boolean {
  return URL.canParse(url) && new URL(url).protocol === 'https:'
}

/** 全屏时保留顶部标题栏高度，保证窗口按钮与 Esc 提示始终可点 */
const TITLEBAR_HEIGHT = 42

export class SitePreviewService {
  private view?: WebContentsView
  private cursorCheck?: ReturnType<typeof setInterval>
  private siteUrl?: string
  private siteLoad?: Promise<void>
  private phase: PreviewPhase = 'hidden'
  private pinned = false
  private fullscreen = false
  private chromeTop = 0
  private editorBounds?: Rectangle
  private triggerBounds?: Rectangle
  private siteId?: string

  constructor(private readonly window: BrowserWindow) {
    const hide = () => this.hide()
    window.on('blur', hide)
    window.on('hide', hide)
    window.on('minimize', hide)
    window.on('resize', hide)
    window.webContents.on('before-input-event', (event, input) => this.handleKey(event, input))
    window.webContents.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
      if (isMainFrame && !isInPlace) this.hide()
    })
    window.on('closed', () => {
      this.reset()
      const contents = this.view?.webContents
      if (contents && !contents.isDestroyed()) contents.close()
    })
  }

  async show(request: SitePreviewRequest, url: string): Promise<void> {
    if (this.window.isDestroyed() || !this.window.isVisible() || !this.window.isFocused()) return

    const windowBounds = this.window.getContentBounds()
    const zoom = this.window.webContents.getZoomFactor()
    const editor = toViewBounds(request.editor, zoom, windowBounds)
    if (!editor) return

    const pinned = request.mode === 'pinned'
    const trigger = request.trigger ? toViewBounds(request.trigger, zoom, windowBounds) : undefined
    if (!pinned && (!trigger || !contains(trigger, this.getCursorPosition()))) return

    const view = this.view ?? this.createView()
    this.siteId = request.siteId
    this.editorBounds = editor
    this.triggerBounds = trigger
    this.chromeTop = Number.isFinite(request.chromeTop)
      ? Math.max(0, Math.min(Math.round(request.chromeTop as number), Math.max(0, editor.height - 60)))
      : 0
    this.pinned = pinned
    this.fullscreen = false
    this.layout()

    if (this.siteUrl === url && this.phase !== 'loading') {
      this.phase = 'ready'
      view.setVisible(true)
      this.startCursorCheck()
      this.emitState()
      return
    }

    this.stopCursorCheck()
    this.phase = 'loading'
    this.emitState()

    if (this.siteUrl !== url) {
      this.siteUrl = url
      const loading = view.webContents.loadURL(url)
      this.siteLoad = loading
      try {
        await loading
      } catch {
        if (this.siteLoad !== loading) return
        this.phase = 'error'
        this.siteUrl = undefined
        this.emitState()
        throw new Error('预览站点加载失败')
      } finally {
        if (this.siteLoad === loading) this.siteLoad = undefined
      }
    }

    // 加载期间可能已被隐藏（鼠标移开 / 老板键），此时不要再弹出来
    if (this.window.isDestroyed() || this.phase !== 'loading') return

    this.phase = 'ready'
    view.setVisible(true)
    this.startCursorCheck()
    this.emitState()
  }

  hide(): void {
    if (this.phase === 'hidden' && !this.cursorCheck) return
    this.reset()
    this.emitState()
  }

  pin(pinned: boolean): void {
    if (this.phase === 'hidden') return
    this.pinned = pinned
    this.startCursorCheck()
    this.emitState()
  }

  command(command: PreviewCommand): void {
    const contents = this.view?.webContents
    if (!contents || contents.isDestroyed() || this.phase === 'hidden') return

    switch (command) {
      case 'back':
        if (contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack()
        break
      case 'forward':
        if (contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward()
        break
      case 'reload':
        contents.reload()
        break
      case 'fullscreen':
        this.fullscreen = !this.fullscreen
        this.layout()
        break
      case 'close':
        this.hide()
        return
    }
    this.emitState()
  }

  private emitState(): void {
    if (this.window.isDestroyed()) return
    const state: SitePreviewState = {
      phase: this.phase,
      siteId: this.siteId,
      pinned: this.pinned,
      fullscreen: this.fullscreen
    }
    this.window.webContents.send('site-preview:state', state)
  }

  private reset(): void {
    this.stopCursorCheck()
    this.phase = 'hidden'
    this.pinned = false
    this.fullscreen = false
    this.editorBounds = undefined
    this.triggerBounds = undefined
    this.siteId = undefined
    if (!this.view || this.window.isDestroyed()) return

    const restoreFocus = this.window.isFocused() && this.view.webContents.isFocused()
    this.view.setVisible(false)
    if (restoreFocus) this.window.webContents.focus()
  }

  private layout(): void {
    if (!this.view || !this.editorBounds) return
    if (this.fullscreen) {
      const bounds = this.window.getContentBounds()
      this.view.setBounds({ x: 0, y: TITLEBAR_HEIGHT, width: bounds.width, height: Math.max(1, bounds.height - TITLEBAR_HEIGHT) })
      return
    }
    const editor = this.editorBounds
    this.view.setBounds({
      x: editor.x,
      y: editor.y + this.chromeTop,
      width: editor.width,
      height: Math.max(1, editor.height - this.chromeTop)
    })
  }

  private startCursorCheck(): void {
    this.stopCursorCheck()
    const editor = this.editorBounds
    if (this.pinned || !editor) return

    const trigger = this.triggerBounds
    this.cursorCheck = setInterval(() => {
      const cursor = this.getCursorPosition()
      if (contains(editor, cursor)) return
      if (trigger && contains(trigger, cursor)) return
      this.hide()
    }, 32)
  }

  private stopCursorCheck(): void {
    if (!this.cursorCheck) return
    clearInterval(this.cursorCheck)
    this.cursorCheck = undefined
  }

  private getCursorPosition(): Point {
    const cursor = screen.getCursorScreenPoint()
    const window = this.window.getContentBounds()
    return { x: cursor.x - window.x, y: cursor.y - window.y }
  }

  private handleKey(event: { preventDefault: () => void }, input: Input): void {
    const contents = this.view?.webContents
    if (this.phase === 'hidden' || !contents || input.type !== 'keyDown') return

    if (input.key === 'Escape') {
      event.preventDefault()
      // 全屏时先退出全屏，再按一次才关闭预览
      if (this.fullscreen) this.command('fullscreen')
      else this.hide()
    } else if (input.alt && input.key === 'ArrowLeft') {
      event.preventDefault()
      this.command('back')
    } else if (input.alt && input.key === 'ArrowRight') {
      event.preventDefault()
      this.command('forward')
    } else if ((input.control || input.meta) && input.key.toLowerCase() === 'r') {
      event.preventDefault()
      this.command('reload')
    }
  }

  private createView(): WebContentsView {
    const view = new WebContentsView({
      webPreferences: {
        partition: 'site-preview',
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        disableDialogs: true
      }
    })
    const contents = view.webContents
    const session = contents.session
    contents.setAudioMuted(true)
    session.setPermissionCheckHandler(() => false)
    session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    const preventDownload = (event: { preventDefault: () => void }) => event.preventDefault()
    session.on('will-download', preventDownload)
    contents.once('destroyed', () => session.off('will-download', preventDownload))
    contents.on('will-frame-navigate', (event) => {
      if (event.isMainFrame && !isHttps(event.url)) event.preventDefault()
    })
    contents.on('will-redirect', (event) => {
      if (event.isMainFrame && !isHttps(event.url)) event.preventDefault()
    })
    contents.setWindowOpenHandler(({ url, postBody }) => {
      if (this.phase !== 'hidden' && !postBody && isHttps(url)) void contents.loadURL(url).catch(() => undefined)
      return { action: 'deny' }
    })
    contents.on('before-input-event', (event, input) => this.handleKey(event, input))
    contents.on('render-process-gone', () => {
      this.siteUrl = undefined
      this.stopCursorCheck()
      this.phase = 'error'
      view.setVisible(false)
      this.emitState()
    })
    view.setVisible(false)
    this.window.contentView.addChildView(view)
    this.view = view
    return view
  }
}
