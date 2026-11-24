import { defineStore } from 'pinia'
import { ref, computed, shallowRef, defineAsyncComponent, type Component } from 'vue'
import type { TabItem } from '@shared/types'
import { toolRegistry } from '../registry'

let tabCounter = 0

export const useTabStore = defineStore('tabs', () => {
  const tabs = ref<TabItem[]>([])
  const activeTabId = ref<string | null>(null)

  // Keep the async component identity stable for each open tab.
  const tabComponents = shallowRef<Map<string, Component>>(new Map())

  const activeTab = computed(() =>
    tabs.value.find((t) => t.id === activeTabId.value) ?? null
  )

  function openTool(toolId: string): void {
    // Check if tool is already open
    const existing = tabs.value.find((t) => t.toolId === toolId)
    if (existing) {
      activeTabId.value = existing.id
      _updateActiveStates()
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
  }

  function closeTab(tabId: string): void {
    const index = tabs.value.findIndex((t) => t.id === tabId)
    if (index === -1) return

    tabs.value.splice(index, 1)
    tabComponents.value.delete(tabId)

    if (activeTabId.value === tabId) {
      if (tabs.value.length > 0) {
        const newIndex = Math.min(index, tabs.value.length - 1)
        activeTabId.value = tabs.value[newIndex].id
      } else {
        activeTabId.value = null
      }
    }
    _updateActiveStates()
  }

  function switchTab(tabId: string): void {
    activeTabId.value = tabId
    _updateActiveStates()
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
    switchTab,
    getTabComponent
  }
})
