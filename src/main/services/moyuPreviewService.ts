import { screen, WebContentsView, type BrowserWindow, type Input, type Point, type Rectangle } from 'electron'
import { moyuSites, type MoyuPreviewRequest, type PreviewRect } from '@shared/moyuPreview'

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

export class MoyuPreviewService {
  private view?: WebContentsView
  private cursorCheck?: ReturnType<typeof setInterval>
  private siteUrl?: MoyuPreviewRequest['url']
  private siteLoad?: Promise<void>

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
      this.hide()
      const contents = this.view?.webContents
      if (contents && !contents.isDestroyed()) contents.close()
    })
  }

  async show(request: MoyuPreviewRequest): Promise<void> {
    if (!moyuSites.some((site) => site.url === request?.url)) return
    if (!this.window.isVisible() || !this.window.isFocused()) return

    const windowBounds = this.window.getContentBounds()
    const zoom = this.window.webContents.getZoomFactor()
    const editor = toViewBounds(request.editor, zoom, windowBounds)
    const trigger = toViewBounds(request.trigger, zoom, windowBounds)
    if (!editor || !trigger || !contains(trigger, this.getCursorPosition())) return
    if (this.cursorCheck && this.siteUrl === request.url) return

    this.hide()
    const view = this.view ?? this.createView()
    view.setBounds(editor)
    view.setVisible(this.siteUrl === request.url && !this.siteLoad)
    this.cursorCheck = setInterval(() => {
      const cursor = this.getCursorPosition()
      if (!contains(editor, cursor) && !contains(trigger, cursor)) this.hide()
    }, 32)

    if (this.siteUrl === request.url) return
    this.siteUrl = request.url
    const loading = view.webContents.loadURL(request.url)
    this.siteLoad = loading
    try {
      await loading
      if (this.siteLoad === loading && this.cursorCheck) view.setVisible(true)
    } catch {
      if (this.siteLoad !== loading || this.window.isDestroyed()) return
      this.siteUrl = undefined
      this.hide()
      throw new Error('预览站点加载失败')
    } finally {
      if (this.siteLoad === loading) this.siteLoad = undefined
    }
  }

  hide(): void {
    if (!this.cursorCheck) return
    clearInterval(this.cursorCheck)
    this.cursorCheck = undefined
    if (!this.view || this.window.isDestroyed()) return

    const restoreFocus = this.window.isFocused() && this.view.webContents.isFocused()
    this.view.setVisible(false)
    if (restoreFocus) this.window.webContents.focus()
  }

  private getCursorPosition(): Point {
    const cursor = screen.getCursorScreenPoint()
    const window = this.window.getContentBounds()
    return { x: cursor.x - window.x, y: cursor.y - window.y }
  }

  private handleKey(event: { preventDefault: () => void }, input: Input): void {
    const contents = this.view?.webContents
    if (!this.cursorCheck || !contents || input.type !== 'keyDown') return

    if (input.key === 'Escape') {
      event.preventDefault()
      this.hide()
    } else if (input.alt && input.key === 'ArrowLeft') {
      event.preventDefault()
      if (contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack()
    } else if (input.alt && input.key === 'ArrowRight') {
      event.preventDefault()
      if (contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward()
    } else if ((input.control || input.meta) && input.key.toLowerCase() === 'r') {
      event.preventDefault()
      contents.reload()
    }
  }

  private createView(): WebContentsView {
    const view = new WebContentsView({
      webPreferences: {
        partition: 'moyu-preview',
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
      if (this.cursorCheck && !postBody && isHttps(url)) void contents.loadURL(url).catch(() => undefined)
      return { action: 'deny' }
    })
    contents.on('before-input-event', (event, input) => this.handleKey(event, input))
    contents.on('render-process-gone', () => {
      this.siteUrl = undefined
      this.hide()
    })
    view.setVisible(false)
    this.window.contentView.addChildView(view)
    this.view = view
    return view
  }
}
