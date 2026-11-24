export interface Site {
  id: string
  name: string
  url: string
}

/** 默认收录的参考文档站点，可自行增删 */
export const defaultSites: readonly Site[] = [
  { id: 'mdn', name: 'MDN Web Docs', url: 'https://developer.mozilla.org/zh-CN/' },
  { id: 'typescript', name: 'TypeScript 文档', url: 'https://www.typescriptlang.org/docs/' },
  { id: 'caniuse', name: 'Can I use', url: 'https://caniuse.com/' },
  { id: 'devdocs', name: 'DevDocs', url: 'https://devdocs.io/' },
  { id: 'regex101', name: 'regex101', url: 'https://regex101.com/' }
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
