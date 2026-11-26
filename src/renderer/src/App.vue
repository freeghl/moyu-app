<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppLayout from './layouts/AppLayout.vue'
import { useAiStore, useMoyuStore, useNavStore, usePrefsStore, useTabStore } from './stores'

const prefsStore = usePrefsStore()
const aiStore = useAiStore()
const tabStore = useTabStore()
const navStore = useNavStore()
const moyuStore = useMoyuStore()
const ready = ref(false)

function openMoyuBrowser(): void {
  navStore.exitSettings()
  tabStore.openTool('moyu-resources')
}

onMounted(async () => {
  await Promise.all([prefsStore.init(), aiStore.init()])
  tabStore.restore()
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
