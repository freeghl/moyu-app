export const moyuSites = [
  { name: 'Quick, Draw!', url: 'https://quickdraw.withgoogle.com/' },
  { name: '机核 GCORES', url: 'https://www.gcores.com/' },
  { name: 'Radio Garden', url: 'https://radio.garden/' },
  { name: 'Google Arts & Culture', url: 'https://artsandculture.google.com/' },
  { name: 'NASA 每日一图', url: 'https://www.nasa.gov/image-of-the-day/' }
] as const

export interface PreviewRect {
  x: number
  y: number
  width: number
  height: number
}

export interface MoyuPreviewRequest {
  url: (typeof moyuSites)[number]['url']
  editor: PreviewRect
  trigger: PreviewRect
}

export interface MoyuPreviewAPI {
  show: (request: MoyuPreviewRequest) => Promise<void>
  hide: () => Promise<void>
}
