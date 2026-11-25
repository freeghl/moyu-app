<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import TitleBar from '../components/TitleBar.vue'
import Sidebar from '../components/Sidebar.vue'
import CodeSidebar from '../components/CodeSidebar.vue'
import TabBar from '../components/TabBar.vue'
import WorkArea from '../components/WorkArea.vue'
import StatusBar from '../components/StatusBar.vue'
import SearchPalette from '../components/SearchPalette.vue'
import { useMoyuStore, useNavStore, useSettingsStore, useTabStore } from '../stores'

const tabStore = useTabStore()
const navStore = useNavStore()
const moyuStore = useMoyuStore()
const settingsStore = useSettingsStore()
const disguised = computed(() =>
  moyuStore.bossMode &&
  tabStore.activeTab?.toolId === 'moyu-resources' &&
  !navStore.isSettings
)

const wallpaperStyle = computed(() => ({
  backgroundImage: `url("${settingsStore.appliedImageUrl}")`,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  opacity: settingsStore.appliedOpacity / 100,
  filter: `blur(${settingsStore.appliedBlur}px)`,
  transform: `scale(${1 + settingsStore.appliedBlur / 500})`
}))

const shellStyle = computed(() => settingsStore.hasBackground ? {
  '--shell-bg': 'rgba(17, 18, 23, 0.66)',
  '--workarea-bg': 'rgba(9, 10, 13, 0.24)',
  '--tab-active-bg': 'rgba(9, 10, 13, 0.42)',
  '--panel-bg': 'rgba(17, 18, 23, 0.58)',
  '--panel-strong-bg': 'rgba(17, 18, 23, 0.78)',
  '--control-bg': 'rgba(9, 10, 13, 0.34)',
  '--panel-border': 'rgba(255, 255, 255, 0.12)'
} : {})

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

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  void settingsStore.init()
})
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div
    class="relative h-screen w-screen overflow-hidden select-none"
    style="background: var(--color-bg-base)"
    :style="shellStyle"
  >
    <div v-if="settingsStore.hasBackground" class="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div class="absolute -inset-8 bg-cover bg-center" :style="wallpaperStyle"></div>
    </div>

    <div class="relative z-10 flex h-full flex-col">
      <TitleBar />

      <div class="flex flex-1 min-h-0">
        <CodeSidebar v-if="disguised" @settings="navStore.setWorkspace('settings')" />
        <Sidebar v-else />

        <div class="flex flex-col flex-1 min-w-0">
          <TabBar v-if="!disguised" />
          <WorkArea />
        </div>
      </div>

      <StatusBar :disguise="disguised" />
      <SearchPalette />
    </div>
  </div>
</template>
