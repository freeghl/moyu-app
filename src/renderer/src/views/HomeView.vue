<script setup lang="ts">
import { toolRegistry } from '../registry'
import { categories } from '../stores/navStore'
import { useNavStore } from '../stores'
import { computed } from 'vue'
import type { ToolManifest } from '@shared/types'

const emit = defineEmits<{
  'open-tool': [toolId: string]
}>()

const navStore = useNavStore()

const currentCategoryTitle = computed(() => {
  if (navStore.activeCategory) {
    const cat = categories.find((c) => c.id === navStore.activeCategory)
    return cat ? cat.name : '分类工具'
  }
  if (navStore.activeWorkspace === 'favorites') return '我的收藏'
  if (navStore.activeWorkspace === 'recent') return '最近使用'
  if (navStore.activeWorkspace === 'all') return '全部工具'
  return '推荐工具'
})

const displayTools = computed<ToolManifest[]>(() => {
  // If specific category is selected
  if (navStore.activeCategory) {
    return toolRegistry.getByCategory(navStore.activeCategory)
  }
  // Favorites view
  if (navStore.activeWorkspace === 'favorites') {
    return toolRegistry.getAll().filter((t) => navStore.favorites.has(t.id))
  }
  // Recent view
  if (navStore.activeWorkspace === 'recent') {
    return navStore.recentTools
      .map((id) => toolRegistry.get(id))
      .filter((t): t is ToolManifest => !!t)
  }
  // Home or All
  return toolRegistry.getAll()
})

function isFavorited(toolId: string): boolean {
  return navStore.favorites.has(toolId)
}

function openSearch() {
  window.dispatchEvent(new CustomEvent('toggle-search'))
}
</script>

<template>
  <div class="h-full overflow-y-auto px-8 py-8 select-none">
    <!-- Hero / Welcome Header (Shown on Home view) -->
    <div v-if="navStore.isHome" class="max-w-4xl mx-auto mb-10">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight" style="color: var(--color-text-primary)">
            桌面端工具集合应用
          </h1>
          <p class="text-xs mt-1.5 leading-relaxed" style="color: var(--color-text-tertiary)">
            固定应用外壳 + 动态工具工作区 · 快捷键
            <span class="kbd-badge mx-1">Ctrl</span>
            <span class="kbd-badge mr-1">K</span>
            快速定位或打开工具
          </p>
        </div>

        <button
          class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shadow-sm border group"
          style="
            background: var(--color-bg-elevated);
            border-color: var(--color-border-default);
            color: var(--color-text-secondary);
          "
          @click="openSearch"
        >
          <svg class="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>搜索工具...</span>
        </button>
      </div>

      <!-- Quick category badges row -->
      <div class="flex items-center gap-2 mt-6 flex-wrap">
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border hover:border-indigo-500/40"
          style="background: var(--color-bg-elevated); border-color: var(--color-border-muted); color: var(--color-text-secondary)"
          @click="navStore.setCategory(cat.id)"
        >
          <span>{{ cat.name }}</span>
          <span class="text-[10px] font-mono text-zinc-500">({{ toolRegistry.getByCategory(cat.id).length }})</span>
        </button>
      </div>
    </div>

    <!-- Section Title -->
    <div class="max-w-4xl mx-auto mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {{ currentCategoryTitle }}
        </h2>
        <span class="text-[11px] font-mono text-zinc-500">({{ displayTools.length }})</span>
      </div>

      <button
        v-if="navStore.activeCategory"
        class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        @click="navStore.setWorkspace('home')"
      >
        ← 返回首页
      </button>
    </div>

    <!-- Empty State -->
    <div
      v-if="displayTools.length === 0"
      class="max-w-4xl mx-auto rounded-2xl border p-12 text-center"
      style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
    >
      <div class="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-xl mb-3" style="background: var(--color-bg-overlay)">
        📂
      </div>
      <h3 class="text-sm font-semibold" style="color: var(--color-text-secondary)">
        暂无可显示的工具
      </h3>
      <p class="text-xs mt-1 text-zinc-500">
        {{ navStore.activeCategory ? '此分类下暂无已注册的工具。每个工具通过 manifest.ts 自动发现。' : '可以在任意工具卡片上点击星标添加至收藏。' }}
      </p>
    </div>

    <!-- Tool Cards Grid -->
    <div v-else class="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <div
        v-for="tool in displayTools"
        :key="tool.id"
        class="card-glow rounded-xl border p-4 text-left transition-all group flex flex-col justify-between cursor-pointer relative"
        style="
          background: var(--color-bg-elevated);
          border-color: var(--color-border-muted);
        "
        @click="emit('open-tool', tool.id)"
      >
        <div>
          <!-- Top Row: Icon, Category & Favorite Toggle -->
          <div class="flex items-center justify-between mb-3">
            <div
              class="w-9 h-9 rounded-lg flex items-center justify-center text-base font-semibold shrink-0 shadow-sm"
              style="background: var(--color-bg-overlay); color: var(--color-text-secondary)"
            >
              {{ tool.icon }}
            </div>

            <div class="flex items-center gap-2">
              <span class="text-[10px] font-mono px-2 py-0.5 rounded-md text-zinc-400" style="background: var(--color-bg-muted)">
                {{ tool.category }}
              </span>

              <!-- Star favorite toggle button -->
              <button
                class="w-6 h-6 flex items-center justify-center rounded transition-colors hover:bg-white/10"
                :title="isFavorited(tool.id) ? '取消收藏' : '添加收藏'"
                @click.stop="navStore.toggleFavorite(tool.id)"
              >
                <svg
                  class="w-3.5 h-3.5 transition-colors"
                  :class="isFavorited(tool.id) ? 'text-amber-400 fill-amber-400' : 'text-zinc-500 group-hover:text-zinc-300'"
                  viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Title & Description -->
          <h3 class="text-xs font-semibold tracking-tight group-hover:text-indigo-400 transition-colors" style="color: var(--color-text-primary)">
            {{ tool.name }}
          </h3>
          <p class="text-[11px] mt-1.5 leading-relaxed line-clamp-2" style="color: var(--color-text-tertiary)">
            {{ tool.description }}
          </p>
        </div>

        <!-- Footer / Launch Hint -->
        <div class="mt-4 pt-2.5 border-t flex items-center justify-between text-[11px]" style="border-color: var(--color-border-subtle)">
          <span class="text-zinc-500 font-mono text-[10px]">#{{ tool.id }}</span>
          <span class="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400 font-medium flex items-center gap-1">
            打开工具 →
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
