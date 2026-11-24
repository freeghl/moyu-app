<script setup lang="ts">
import { ref, onMounted } from 'vue'

const isMaximized = ref(false)

onMounted(async () => {
  if (window.api?.window) {
    isMaximized.value = await window.api.window.isMaximized()
    window.api.window.onMaximizedChanged((val: boolean) => {
      isMaximized.value = val
    })
  }
})

function minimize() {
  window.api?.window.minimize()
}

function maximize() {
  window.api?.window.maximize()
}

function close() {
  window.api?.window.close()
}

function openSearch() {
  window.dispatchEvent(new CustomEvent('toggle-search'))
}
</script>

<template>
  <header
    class="flex items-center justify-between shrink-0 border-b select-none"
    style="
      height: var(--titlebar-height);
      background: var(--color-bg-elevated);
      border-color: var(--color-border-muted);
      -webkit-app-region: drag;
    "
  >
    <!-- Left: Logo & App Name -->
    <div class="flex items-center gap-2.5 pl-3.5" style="-webkit-app-region: no-drag">
      <div
        class="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shadow-sm"
        style="
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
        "
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      </div>
      <span class="text-xs font-semibold tracking-wide" style="color: var(--color-text-primary)">
        Moyu Toolbox
      </span>
    </div>

    <!-- Center: Raycast Style Command Search Trigger -->
    <div class="flex items-center justify-center" style="-webkit-app-region: no-drag">
      <button
        class="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-150 group"
        style="
          background: var(--color-bg-surface);
          border: 1px solid var(--color-border-default);
          color: var(--color-text-tertiary);
          min-width: 280px;
        "
        @click="openSearch"
      >
        <svg class="w-3.5 h-3.5 transition-colors group-hover:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span class="text-[12px] group-hover:text-zinc-200 transition-colors">搜索工具或命令...</span>
        <div class="flex items-center gap-1 ml-auto">
          <span class="kbd-badge">Ctrl</span>
          <span class="kbd-badge">K</span>
        </div>
      </button>
    </div>

    <!-- Right: Window Action Buttons -->
    <div class="flex items-center h-full" style="-webkit-app-region: no-drag">
      <!-- Minimize -->
      <button
        class="w-11 h-full flex items-center justify-center transition-colors hover:bg-white/[0.06]"
        style="color: var(--color-text-secondary)"
        title="最小化"
        @click="minimize"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14" />
        </svg>
      </button>

      <!-- Maximize / Restore -->
      <button
        class="w-11 h-full flex items-center justify-center transition-colors hover:bg-white/[0.06]"
        style="color: var(--color-text-secondary)"
        :title="isMaximized ? '向下还原' : '最大化'"
        @click="maximize"
      >
        <svg v-if="!isMaximized" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
        <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
          <path d="M8 4h12v12M4 8h12v12H4z" />
        </svg>
      </button>

      <!-- Close -->
      <button
        class="w-11 h-full flex items-center justify-center transition-colors hover:bg-rose-600 hover:text-white"
        style="color: var(--color-text-secondary)"
        title="关闭"
        @click="close"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </header>
</template>
