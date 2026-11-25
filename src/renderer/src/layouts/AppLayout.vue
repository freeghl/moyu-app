<script setup lang="ts">
import TitleBar from '../components/TitleBar.vue'
import Sidebar from '../components/Sidebar.vue'
import TabBar from '../components/TabBar.vue'
import WorkArea from '../components/WorkArea.vue'
import StatusBar from '../components/StatusBar.vue'
import SearchPalette from '../components/SearchPalette.vue'
import { useSettingsStore } from '../stores'
import { computed } from 'vue'

const settingsStore = useSettingsStore()
const wallpaperStyle = computed(() => ({
  backgroundImage: `url("${settingsStore.appliedImageUrl}")`,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  opacity: settingsStore.appliedOpacity / 100,
  filter: `blur(${settingsStore.appliedBlur}px)`,
  transform: `scale(${1 + settingsStore.appliedBlur / 500})`
}))
const shellStyle = computed<Record<string, string>>(() => ({
  background: 'var(--color-bg-base)',
  ...(settingsStore.hasBackground
    ? {
        '--shell-bg': 'rgba(17, 18, 23, 0.68)',
        '--workarea-bg': 'rgba(9, 10, 13, 0.28)',
        '--tab-active-bg': 'rgba(9, 10, 13, 0.46)'
      }
    : {})
}))
</script>

<template>
  <div class="relative flex h-screen w-screen flex-col overflow-hidden select-none" :style="shellStyle">
    <div v-if="settingsStore.hasBackground" class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div class="wallpaper absolute -inset-4 bg-no-repeat" :style="wallpaperStyle"></div>
    </div>

    <div class="relative z-10 flex h-full w-full flex-col">
      <!-- Title Bar -->
      <TitleBar />

      <!-- Main Body -->
      <div class="flex flex-1 min-h-0">
        <!-- Sidebar -->
        <Sidebar />

        <!-- Content Area -->
        <div class="flex flex-col flex-1 min-w-0">
          <!-- Tab Bar -->
          <TabBar />

          <!-- Work Area -->
          <WorkArea />
        </div>
      </div>

      <!-- Status Bar -->
      <StatusBar />

      <!-- Search Palette (overlay) -->
      <SearchPalette />
    </div>
  </div>
</template>

<style scoped>
.wallpaper {
  transition: opacity 160ms ease, filter 160ms ease, transform 160ms ease;
}

@media (prefers-reduced-motion: reduce) {
  .wallpaper {
    transition: none;
  }
}
</style>
