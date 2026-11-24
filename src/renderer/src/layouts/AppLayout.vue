<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import TitleBar from '../components/TitleBar.vue'
import Sidebar from '../components/Sidebar.vue'
import CodeSidebar from '../components/CodeSidebar.vue'
import TabBar from '../components/TabBar.vue'
import WorkArea from '../components/WorkArea.vue'
import StatusBar from '../components/StatusBar.vue'
import SearchPalette from '../components/SearchPalette.vue'
import { useMoyuStore, useNavStore, useTabStore } from '../stores'

const tabStore = useTabStore()
const navStore = useNavStore()
const moyuStore = useMoyuStore()
const disguised = computed(() =>
  moyuStore.bossMode &&
  tabStore.activeTab?.toolId === 'moyu-resources' &&
  !navStore.isSettings
)

function isPaletteOpen(): boolean {
  return Boolean(document.querySelector('[data-search-palette]'))
}

function handleKeydown(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return
  const key = event.key.toLowerCase()

  if (key === 'w' && !event.shiftKey) {
    if (!tabStore.activeTabId) return
    event.preventDefault()
    tabStore.closeTab(tabStore.activeTabId)
    return
  }

  if (key === 't' && event.shiftKey) {
    event.preventDefault()
    tabStore.reopenClosed()
    return
  }

  if (key === 'tab' && !isPaletteOpen()) {
    const tabs = tabStore.tabs
    if (tabs.length < 2) return
    event.preventDefault()
    const index = tabs.findIndex((tab) => tab.id === tabStore.activeTabId)
    const step = event.shiftKey ? -1 : 1
    const next = tabs[(index + step + tabs.length) % tabs.length]
    tabStore.switchTab(next.id)
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div class="flex flex-col h-screen w-screen overflow-hidden select-none" style="background: var(--color-bg-base)">
    <!-- Title Bar -->
    <TitleBar />

    <!-- Main Body -->
    <div class="flex flex-1 min-h-0">
      <!-- Sidebar -->
      <CodeSidebar v-if="disguised" @settings="navStore.setWorkspace('settings')" />
      <Sidebar v-else />

      <!-- Content Area -->
      <div class="flex flex-col flex-1 min-w-0">
        <!-- Tab Bar -->
        <TabBar v-if="!disguised" />

        <!-- Work Area -->
        <WorkArea />
      </div>
    </div>

    <!-- Status Bar -->
    <StatusBar :disguise="disguised" />

    <!-- Search Palette (overlay) -->
    <SearchPalette />
  </div>
</template>
