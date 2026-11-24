export interface MoyuSite {
  id: string
  name: string
  url: string
}

export const moyuSites: readonly MoyuSite[] = [
  { id: 'quick-draw', name: 'Quick, Draw!', url: 'https://quickdraw.withgoogle.com/' },
  { id: 'gcores', name: '机核 GCORES', url: 'https://www.gcores.com/' },
  { id: 'radio-garden', name: 'Radio Garden', url: 'https://radio.garden/' },
  { id: 'arts-and-culture', name: 'Google Arts & Culture', url: 'https://artsandculture.google.com/' },
  { id: 'nasa', name: 'NASA 每日一图', url: 'https://www.nasa.gov/image-of-the-day/' }
]

export type MoyuSiteChange =
  | { type: 'save'; id?: string; name: string; url: string }
  | { type: 'remove'; id: string }

export type MoyuSiteChangeResult =
  | { sites: MoyuSite[]; selectedId?: string }
  | { error: string }

export interface PreviewRect {
  x: number
  y: number
  width: number
  height: number
}

export interface MoyuPreviewRequest {
  siteId: string
  editor: PreviewRect
  trigger: PreviewRect
}

export interface MoyuPreviewAPI {
  show: (request: MoyuPreviewRequest) => Promise<void>
  hide: () => Promise<void>
  listSites: () => Promise<MoyuSite[]>
  changeSite: (change: MoyuSiteChange) => Promise<MoyuSiteChangeResult>
}
