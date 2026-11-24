import { defineStore } from 'pinia'
import { computed } from 'vue'
import { CATEGORIES } from '@shared/categories'
import type { ToolCategory, WorkspaceItem } from '@shared/types'
import { usePrefsStore } from './prefsStore'

/** 分类展示信息（保留原导出名，供侧边栏与首页复用） */
export const categories = CATEGORIES

const MAX_RECENT = 20

export const useNavStore = defineStore('nav', () => {
  const prefs = usePrefsStore()

  const activeWorkspace = computed(() => prefs.state.session.workspace)
  const activeCategory = computed(() => prefs.state.session.category)
  const sidebarCollapsed = computed(() => prefs.state.session.sidebarCollapsed)
  const favorites = computed(() => new Set(prefs.state.favorites))
  const recentTools = computed(() => prefs.state.recentTools)
  const collapsedCategories = computed(() => new Set(prefs.state.session.collapsedCategories))

  const isHome = computed(() => activeWorkspace.value === 'home' && !activeCategory.value)
  const isSettings = computed(() => activeWorkspace.value === 'settings')

  function setWorkspace(item: WorkspaceItem): void {
    prefs.patch({ session: { workspace: item, category: null } })
  }

  function setCategory(cat: ToolCategory): void {
    prefs.patch({ session: { workspace: 'all', category: cat } })
  }

  /** 打开工具时离开设置页，避免用户以为点击没反应 */
  function exitSettings(): void {
    if (isSettings.value) setWorkspace('home')
  }

  function toggleSidebar(): void {
    prefs.patch({ session: { sidebarCollapsed: !sidebarCollapsed.value } })
  }

  function toggleCategoryCollapse(cat: ToolCategory): void {
    const current = prefs.state.session.collapsedCategories
    const next = current.includes(cat) ? current.filter((item) => item !== cat) : [...current, cat]
    prefs.patch({ session: { collapsedCategories: next } })
  }

  function toggleFavorite(toolId: string): void {
    const current = prefs.state.favorites
    const next = current.includes(toolId)
      ? current.filter((id) => id !== toolId)
      : [...current, toolId]
    prefs.patch({ favorites: next })
  }

  function addRecent(toolId: string): void {
    const next = [toolId, ...prefs.state.recentTools.filter((id) => id !== toolId)].slice(0, MAX_RECENT)
    prefs.patch({ recentTools: next })
  }

  return {
    activeWorkspace,
    activeCategory,
    sidebarCollapsed,
    favorites,
    recentTools,
    collapsedCategories,
    isHome,
    isSettings,
    setWorkspace,
    setCategory,
    exitSettings,
    toggleSidebar,
    toggleCategoryCollapse,
    toggleFavorite,
    addRecent
  }
})
