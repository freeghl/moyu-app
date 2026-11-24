import { defineStore } from 'pinia'
import { ref, computed, shallowRef, defineAsyncComponent, type Component } from 'vue'
import type { TabItem } from '@shared/types'
import { toolRegistry } from '../registry'
import { usePrefsStore } from './prefsStore'

let tabCounter = 0
const MAX_CLOSED = 10

export const useTabStore = defineStore('tabs', () => {
  const prefs = usePrefsStore()

  const tabs = ref<TabItem[]>([])
  const activeTabId = ref<string | null>(null)

  // Keep the async component identity stable for each open tab.
  const tabComponents = shallowRef<Map<string, Component>>(new Map())
  const closedStack: string[] = []
  let restoring = false

  const activeTab = computed(() =>
    tabs.value.find((t) => t.id === activeTabId.value) ?? null
  )

  function persist(): void {
    if (restoring) return
    prefs.patch({
      session: {
        tabs: tabs.value.map((tab) => tab.toolId),
        activeToolId: activeTab.value?.toolId ?? null
      }
    })
  }

  function openTool(toolId: string): void {
    const existing = tabs.value.find((t) => t.toolId === toolId)
    if (existing) {
      activeTabId.value = existing.id
      _updateActiveStates()
      persist()
      return
    }

    const tool = toolRegistry.get(toolId)
    if (!tool) return

    const tabId = `tab-${++tabCounter}`
    const tab: TabItem = {
      id: tabId,
      toolId: tool.id,
      name: tool.name,
      icon: tool.icon,
      isActive: true
    }

    tabComponents.value.set(tabId, defineAsyncComponent(tool.component))

    tabs.value.push(tab)
    activeTabId.value = tabId
    _updateActiveStates()
    persist()
  }

  function closeTab(tabId: string): void {
    const index = tabs.value.findIndex((t) => t.id === tabId)
    if (index === -1) return

    const [removed] = tabs.value.splice(index, 1)
    tabComponents.value.delete(tabId)
    closedStack.push(removed.toolId)
    if (closedStack.length > MAX_CLOSED) closedStack.shift()

    if (activeTabId.value === tabId) {
      if (tabs.value.length > 0) {
        const newIndex = Math.min(index, tabs.value.length - 1)
        activeTabId.value = tabs.value[newIndex].id
      } else {
        activeTabId.value = null
      }
    }
    _updateActiveStates()
    persist()
  }

  function closeOthers(tabId: string): void {
    for (const tab of [...tabs.value]) {
      if (tab.id !== tabId) removeWithoutHistory(tab.id)
    }
    activeTabId.value = tabId
    _updateActiveStates()
    persist()
  }

  function closeAll(): void {
    for (const tab of [...tabs.value]) removeWithoutHistory(tab.id)
    activeTabId.value = null
    _updateActiveStates()
    persist()
  }

  function reopenClosed(): void {
    const toolId = closedStack.pop()
    if (toolId) openTool(toolId)
  }

  function switchTab(tabId: string): void {
    activeTabId.value = tabId
    _updateActiveStates()
    persist()
  }

  function reorderTab(tabId: string, targetIndex: number): void {
    const from = tabs.value.findIndex((t) => t.id === tabId)
    if (from === -1 || from === targetIndex) return
    const [tab] = tabs.value.splice(from, 1)
    tabs.value.splice(Math.min(Math.max(targetIndex, 0), tabs.value.length), 0, tab)
    persist()
  }

  /** 启动时恢复上次的标签现场 */
  function restore(): void {
    const session = prefs.state.session
    if (!prefs.state.settings.restoreSession || !session.tabs.length) return

    restoring = true
    try {
      for (const toolId of session.tabs) openTool(toolId)
      const target = tabs.value.find((tab) => tab.toolId === session.activeToolId)
      if (target) {
        activeTabId.value = target.id
        _updateActiveStates()
      }
    } finally {
      restoring = false
    }
    persist()
  }

  function removeWithoutHistory(tabId: string): void {
    const index = tabs.value.findIndex((t) => t.id === tabId)
    if (index === -1) return
    tabs.value.splice(index, 1)
    tabComponents.value.delete(tabId)
  }

  function _updateActiveStates(): void {
    tabs.value.forEach((t) => {
      t.isActive = t.id === activeTabId.value
    })
  }

  function getTabComponent(tabId: string) {
    return tabComponents.value.get(tabId)
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    openTool,
    closeTab,
    closeOthers,
    closeAll,
    reopenClosed,
    switchTab,
    reorderTab,
    restore,
    getTabComponent
  }
})
