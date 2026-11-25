<script setup lang="ts">
import { useTabStore } from '../stores'

const tabStore = useTabStore()

function openSearch() {
  window.dispatchEvent(new CustomEvent('toggle-search'))
}
</script>

<template>
  <div
    class="flex items-end shrink-0 overflow-x-auto border-b select-none"
    style="
      height: var(--tabbar-height);
      background: var(--shell-bg, var(--color-bg-elevated));
      border-color: var(--color-border-muted);
    "
    v-show="tabStore.tabs.length > 0"
  >
    <div class="flex items-end flex-1 min-w-0 overflow-x-auto">
      <div
        v-for="tab in tabStore.tabs"
        :key="tab.id"
        class="flex items-center gap-2 px-3 h-[36px] shrink-0 cursor-pointer transition-all group border-r relative"
        :class="[tab.isActive ? 'shadow-sm' : 'hover:bg-white/[0.03]']"
        :style="{
          maxWidth: '220px',
          background: tab.isActive ? 'var(--tab-active-bg, var(--color-bg-base))' : 'transparent',
          borderColor: 'var(--color-border-muted)',
          color: tab.isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'
        }"
        @click="tabStore.switchTab(tab.id)"
        @auxclick.stop="tabStore.closeTab(tab.id)"
      >
        <!-- Top Active Indicator Stripe -->
        <div
          v-if="tab.isActive"
          class="absolute top-0 left-0 right-0 h-[2px]"
          style="background: linear-gradient(90deg, #6366f1, #8b5cf6);"
        ></div>

        <!-- Tab Icon -->
        <span class="text-xs shrink-0 opacity-80 group-hover:opacity-100">{{ tab.icon }}</span>

        <!-- Tab Title -->
        <span class="text-xs font-medium truncate flex-1">{{ tab.name }}</span>

        <!-- Close Button -->
        <button
          class="w-4 h-4 flex items-center justify-center rounded-sm transition-all ml-1 shrink-0"
          :class="[
            tab.isActive
              ? 'opacity-60 hover:opacity-100 hover:bg-white/10'
              : 'opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-white/10'
          ]"
          title="关闭标签页"
          @click.stop="tabStore.closeTab(tab.id)"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Quick add new tool button -->
    <div class="flex items-center px-2 h-full shrink-0">
      <button
        class="w-7 h-7 flex items-center justify-center rounded-md transition-colors hover:bg-white/[0.08]"
        style="color: var(--color-text-tertiary)"
        title="打开新工具 (Ctrl + K)"
        @click="openSearch"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
    </div>
  </div>
</template>
