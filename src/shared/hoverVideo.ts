export const HOVER_VIDEO_WIDTH = 270
export const HOVER_VIDEO_HEIGHT = 480
export const HOVER_VIDEO_HOTSPOT_SIZE = 84

export const HOVER_VIDEO_SOURCE_IDS = ['tiktok', 'douyin', 'bilibili'] as const
export type HoverVideoSourceId = typeof HOVER_VIDEO_SOURCE_IDS[number]

export const HOVER_VIDEO_SOURCE_NAMES: Record<HoverVideoSourceId, string> = {
  tiktok: 'TikTok',
  douyin: '抖音',
  bilibili: '哔哩哔哩'
}

export function isHoverVideoSourceId(value: unknown): value is HoverVideoSourceId {
  return typeof value === 'string' && HOVER_VIDEO_SOURCE_IDS.includes(value as HoverVideoSourceId)
}

export interface HoverVideoHotspot {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  displayId: number
}

export interface HoverVideoPreferences {
  enabled: boolean
  muted: boolean
  sources: HoverVideoSourceId[]
  hotspots: HoverVideoHotspot[]
}

export type HoverVideoStatus = 'hidden' | 'loading' | 'playing' | 'error'

export interface HoverVideoState {
  status: HoverVideoStatus
  activeSource?: HoverVideoSourceId
  loginStates: Record<HoverVideoSourceId, boolean>
  capturing: boolean
  notice?: string
}

export interface HoverVideoAPI {
  openLogin: (source: HoverVideoSourceId) => Promise<void>
  finishLogin: (source: HoverVideoSourceId) => Promise<void>
  captureHotspot: () => Promise<HoverVideoHotspot>
  removeHotspot: (id: string) => Promise<void>
  onState: (callback: (state: HoverVideoState) => void) => () => void
}
