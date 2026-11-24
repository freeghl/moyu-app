<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppLayout from './layouts/AppLayout.vue'
import { useMoyuStore, useNavStore, usePrefsStore, useTabStore } from './stores'

const prefsStore = usePrefsStore()
const tabStore = useTabStore()
const navStore = useNavStore()
const moyuStore = useMoyuStore()
const ready = ref(false)

function openMoyuBrowser(): void {
  navStore.exitSettings()
  tabStore.openTool('moyu-resources')
}

onMounted(async () => {
  await prefsStore.init()
  tabStore.restore()
  if (!tabStore.tabs.length) openMoyuBrowser()
  ready.value = true

  window.api?.onToggleBoss(() => {
    openMoyuBrowser()
    moyuStore.toggleBossMode()
  })
  window.api?.onToggleSearch(() => {
    window.dispatchEvent(new CustomEvent('toggle-search'))
  })
})
</script>

<template>
  <AppLayout v-if="ready" />
  <div v-else class="h-screen w-screen" style="background: var(--color-bg-base)"></div>
</template>
