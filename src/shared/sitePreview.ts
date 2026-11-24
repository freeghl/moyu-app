export interface Site {
  id: string
  name: string
  url: string
}

/** 默认收录的摸鱼站点，可自行增删 */
export const defaultSites: readonly Site[] = [
  { id: 'quick-draw', name: 'Quick, Draw!', url: 'https://quickdraw.withgoogle.com/' },
  { id: 'gcores', name: '机核 GCORES', url: 'https://www.gcores.com/' },
  { id: 'radio-garden', name: 'Radio Garden', url: 'https://radio.garden/' },
  { id: 'arts-and-culture', name: 'Google Arts & Culture', url: 'https://artsandculture.google.com/' },
  { id: 'nasa', name: 'NASA 每日一图', url: 'https://www.nasa.gov/image-of-the-day/' }
]

export type SiteChange =
  | { type: 'save'; id?: string; name: string; url: string }
  | { type: 'remove'; id: string }

export type SiteChangeResult =
  | { sites: Site[]; selectedId?: string }
  | { error: string }

export interface PreviewRect {
  x: number
  y: number
  width: number
  height: number
}

/** peek: 鼠标悬停临时预览，离开即收起；pinned: 手动打开并常驻，直到主动关闭 */
export type PreviewMode = 'peek' | 'pinned'

export interface SitePreviewRequest {
  siteId: string
  /** 预览覆盖的区域（通常是代码编辑区） */
  editor: PreviewRect
  /** 覆盖区域顶部留给工具条的高度，预览内容会从这个高度之下开始 */
  chromeTop?: number
  /** 悬停触发区，peek 模式下必须提供且鼠标需停留在其中 */
  trigger?: PreviewRect
  mode?: PreviewMode
}

export type PreviewPhase = 'hidden' | 'loading' | 'ready' | 'error'

export interface SitePreviewState {
  phase: PreviewPhase
  siteId?: string
  pinned: boolean
  fullscreen: boolean
  error?: string
}

export type PreviewCommand = 'back' | 'forward' | 'reload' | 'fullscreen' | 'close'

export interface SitePreviewAPI {
  show: (request: SitePreviewRequest) => Promise<void>
  hide: () => Promise<void>
  pin: (pinned: boolean) => Promise<void>
  command: (command: PreviewCommand) => Promise<void>
  listSites: () => Promise<Site[]>
  changeSite: (change: SiteChange) => Promise<SiteChangeResult>
  onState: (callback: (state: SitePreviewState) => void) => () => void
}
