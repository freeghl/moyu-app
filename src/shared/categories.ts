import type { CategoryInfo, ToolCategory } from './types'

export const CATEGORIES: readonly CategoryInfo[] = [
  { id: 'dev', name: '开发工具', icon: 'code-bracket' },
  { id: 'network', name: '网络工具', icon: 'globe-alt' },
  { id: 'image', name: '图片工具', icon: 'photo' },
  { id: 'file', name: '文件工具', icon: 'folder' },
  { id: 'crypto', name: '加密工具', icon: 'lock-closed' },
  { id: 'ai', name: 'AI 工具', icon: 'sparkles' }
]

export const CATEGORY_IDS: readonly ToolCategory[] = CATEGORIES.map((item) => item.id)

export function categoryName(id: string): string {
  return CATEGORIES.find((item) => item.id === id)?.name ?? id
}
