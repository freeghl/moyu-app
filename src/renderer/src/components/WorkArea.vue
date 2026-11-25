<script setup lang="ts">
import { useTabStore, useNavStore } from '../stores'
import { computed } from 'vue'
import HomeView from '../views/HomeView.vue'

const tabStore = useTabStore()
const navStore = useNavStore()

const showHome = computed(() => tabStore.tabs.length === 0)

function handleToolClick(toolId: string): void {
  tabStore.openTool(toolId)
  navStore.addRecent(toolId)
}
</script>

<template>
  <main
    class="flex-1 min-h-0 relative overflow-hidden"
    :style="{ background: 'var(--workarea-bg, var(--color-bg-base))' }"
  >
    <!-- Empty / Dashboard Home View when no tabs are opened -->
    <HomeView v-if="showHome" @open-tool="handleToolClick" />

    <!-- Active Tool Tabs: Each open tool remains mounted and uses v-show to guarantee 100% state retention -->
    <div
      v-for="tab in tabStore.tabs"
      :key="tab.id"
      class="absolute inset-0 overflow-auto"
      v-show="tab.isActive"
    >
      <Suspense>
        <component :is="tabStore.getTabComponent(tab.id)" />
        <template #fallback>
          <div class="flex items-center justify-center h-full">
            <div class="flex flex-col items-center gap-3">
              <div
                class="w-6 h-6 border-2 rounded-full animate-spin"
                style="border-color: var(--color-bg-muted); border-top-color: var(--color-accent)"
              ></div>
              <span class="text-xs" style="color: var(--color-text-tertiary)">工具加载中...</span>
            </div>
          </div>
        </template>
      </Suspense>
    </div>
  </main>
</template>
