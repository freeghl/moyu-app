import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { WorkspaceItem, ToolCategory, CategoryInfo } from '@shared/types'

export const categories: CategoryInfo[] = [
  { id: 'dev', name: '开发工具', icon: 'code-bracket' },
  { id: 'network', name: '网络工具', icon: 'globe-alt' },
  { id: 'image', name: '图片工具', icon: 'photo' },
  { id: 'file', name: '文件工具', icon: 'folder' },
  { id: 'crypto', name: '加密工具', icon: 'lock-closed' },
  { id: 'ai', name: 'AI 工具', icon: 'sparkles' },
  { id: 'system', name: '系统工具', icon: 'computer-desktop' }
]

export const useNavStore = defineStore('nav', () => {
  const activeWorkspace = ref<WorkspaceItem>('home')
  const activeCategory = ref<ToolCategory | null>(null)
  const sidebarCollapsed = ref(false)
  const collapsedCategories = ref<Set<ToolCategory>>(new Set())
  const favorites = ref<Set<string>>(new Set())
  const recentTools = ref<string[]>([])

  const isHome = computed(() => activeWorkspace.value === 'home' && !activeCategory.value)

  function setWorkspace(item: WorkspaceItem): void {
    activeWorkspace.value = item
    activeCategory.value = null
  }

  function setCategory(cat: ToolCategory): void {
    activeCategory.value = cat
    activeWorkspace.value = 'all'
  }

  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function toggleCategoryCollapse(cat: ToolCategory): void {
    if (collapsedCategories.value.has(cat)) {
      collapsedCategories.value.delete(cat)
    } else {
      collapsedCategories.value.add(cat)
    }
  }

  function toggleFavorite(toolId: string): void {
    if (favorites.value.has(toolId)) {
      favorites.value.delete(toolId)
    } else {
      favorites.value.add(toolId)
    }
    // Persist
    localStorage.setItem('favorites', JSON.stringify([...favorites.value]))
  }

  function addRecent(toolId: string): void {
    recentTools.value = [toolId, ...recentTools.value.filter((id) => id !== toolId)].slice(0, 20)
    localStorage.setItem('recentTools', JSON.stringify(recentTools.value))
  }

  // Load from localStorage
  function init(): void {
    try {
      const savedFavorites = localStorage.getItem('favorites')
      if (savedFavorites) favorites.value = new Set(JSON.parse(savedFavorites))

      const savedRecent = localStorage.getItem('recentTools')
      if (savedRecent) recentTools.value = JSON.parse(savedRecent)
    } catch {
      // ignore
    }
  }

  return {
    activeWorkspace,
    activeCategory,
    sidebarCollapsed,
    collapsedCategories,
    favorites,
    recentTools,
    isHome,
    setWorkspace,
    setCategory,
    toggleSidebar,
    toggleCategoryCollapse,
    toggleFavorite,
    addRecent,
    init
  }
})
