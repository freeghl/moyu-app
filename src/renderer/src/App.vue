<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppLayout from './layouts/AppLayout.vue'
import { usePrefsStore, useTabStore } from './stores'

const prefsStore = usePrefsStore()
const tabStore = useTabStore()
const ready = ref(false)

onMounted(async () => {
  await prefsStore.init()
  tabStore.restore()
  ready.value = true

  // 全局唤出（主进程快捷键 / 托盘）→ 打开命令面板
  window.api?.onToggleSearch(() => {
    window.dispatchEvent(new CustomEvent('toggle-search'))
  })
})
</script>

<template>
  <AppLayout v-if="ready" />
  <div v-else class="h-screen w-screen" style="background: var(--color-bg-base)"></div>
</template>
