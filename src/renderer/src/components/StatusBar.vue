<script setup lang="ts">
import { useTabStore } from '../stores'
import { computed } from 'vue'

const tabStore = useTabStore()

const currentToolName = computed(() => {
  return tabStore.activeTab?.name ?? null
})
</script>

<template>
  <footer
    class="flex items-center justify-between shrink-0 px-3.5 border-t select-none text-[11px]"
    style="
      height: var(--statusbar-height);
      background: var(--color-bg-elevated);
      border-color: var(--color-border-muted);
      color: var(--color-text-tertiary);
    "
  >
    <!-- Left: Application Running Status -->
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style="background: var(--color-success)"></span>
          <span class="relative inline-flex rounded-full h-2 w-2" style="background: var(--color-success)"></span>
        </span>
        <span class="font-medium" style="color: var(--color-text-secondary)">就绪</span>
      </div>

      <span v-if="currentToolName" class="text-zinc-600">/</span>

      <span v-if="currentToolName" class="font-medium truncate max-w-[200px]" style="color: var(--color-accent-hover)">
        {{ currentToolName }}
      </span>
    </div>

    <!-- Center: Raycast Keyboard Tips -->
    <div class="hidden md:flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
      <span>按下</span>
      <span class="kbd-badge">Ctrl</span>
      <span class="kbd-badge">K</span>
      <span>呼出全局命令面板</span>
    </div>

    <!-- Right: Version info & badges -->
    <div class="flex items-center gap-3 font-mono">
      <span>已打开标签: {{ tabStore.tabs.length }}</span>
      <span class="text-zinc-700">|</span>
      <span>v1.0.0</span>
    </div>
  </footer>
</template>
