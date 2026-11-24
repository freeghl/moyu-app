/** Tool category identifiers */
export type ToolCategory =
  | 'dev'
  | 'network'
  | 'image'
  | 'file'
  | 'crypto'
  | 'ai'

/** Navigation workspace items */
export type WorkspaceItem = 'home' | 'all' | 'favorites' | 'recent'

/** Tool manifest definition */
export interface ToolManifest {
  id: string
  name: string
  description: string
  icon: string
  category: ToolCategory
  keywords?: string[]
  component: () => Promise<any>
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
