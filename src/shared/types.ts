import type { Component } from 'vue'

/** Tool category identifiers */
export type ToolCategory =
  | 'dev'
  | 'network'
  | 'image'
  | 'file'
  | 'crypto'
  | 'ai'
  | 'system'

/** Navigation workspace items */
export type WorkspaceItem = 'home' | 'all' | 'favorites' | 'recent' | 'settings'

/** Tool manifest definition */
export interface ToolManifest {
  id: string
  name: string
  description: string
  icon: string
  category: ToolCategory
  keywords?: string[]
  component: () => Promise<Component>
}

/** Tab state */
export interface TabItem {
  id: string
  toolId: string
  name: string
  icon: string
  isActive: boolean
}

/** Category display info */
export interface CategoryInfo {
  id: ToolCategory
  name: string
  icon: string
  collapsed?: boolean
}

export interface BackgroundImage {
  fileName: string
  originalName: string
  dataUrl: string
}

export interface BackgroundPreferences {
  fileName: string
  originalName: string
  opacity: number
  blur: number
}

export interface BackgroundAPI {
  select: () => Promise<BackgroundImage | null>
  load: (fileName: string) => Promise<BackgroundImage | null>
  remove: (fileName: string) => Promise<void>
}
