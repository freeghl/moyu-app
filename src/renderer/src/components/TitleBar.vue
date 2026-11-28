<script setup lang="ts">
import { ref, onMounted } from 'vue'
import appIcon from '../../../../resources/icon.png'

const isMaximized = ref(false)

onMounted(async () => {
  if (window.api?.window) {
    isMaximized.value = await window.api.window.isMaximized()
    window.api.window.onMaximizedChanged((value: boolean) => {
      isMaximized.value = value
    })
  }
})

function minimize(): void {
  window.api?.window.minimize()
}

function maximize(): void {
  window.api?.window.maximize()
}

function close(): void {
  window.api?.window.close()
}
</script>

<template>
  <header
    class="flex h-10 shrink-0 items-center justify-between border-b border-(--color-border-muted) select-none"
    style="background: var(--shell-bg); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); -webkit-app-region: drag"
  >
    <div class="flex min-w-0 flex-1 items-center gap-2 pl-3" style="-webkit-app-region: drag">
      <img :src="appIcon" alt="" draggable="false" class="h-5 w-5 shrink-0" style="-webkit-app-region: drag" />
      <span class="text-[11px] text-(--color-text-secondary)" style="-webkit-app-region: drag">摸鱼</span>
    </div>

    <div class="flex h-full shrink-0 items-center" style="-webkit-app-region: no-drag">
      <button class="flex h-full w-11 items-center justify-center text-(--color-text-secondary) hover:bg-white/[0.06]" title="最小化" @click="minimize">
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" d="M5 12h14" />
        </svg>
      </button>
      <button class="flex h-full w-11 items-center justify-center text-(--color-text-secondary) hover:bg-white/[0.06]" :title="isMaximized ? '向下还原' : '最大化'" @click="maximize">
        <svg v-if="!isMaximized" class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
          <rect x="4" y="4" width="16" height="16" rx="1" />
        </svg>
        <svg v-else class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 4h12v12M4 8h12v12H4z" />
        </svg>
      </button>
      <button class="flex h-full w-11 items-center justify-center text-(--color-text-secondary) hover:bg-rose-600 hover:text-white" title="关闭" @click="close">
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" d="m6 6 12 12M6 18 18 6" />
        </svg>
      </button>
    </div>
  </header>
</template>
