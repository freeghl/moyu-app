<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { toolRegistry } from '../registry'
import { useTabStore, useNavStore } from '../stores'
import { categoryName } from '@shared/categories'
import type { ToolManifest } from '@shared/types'

const tabStore = useTabStore()
const navStore = useNavStore()

const isOpen = ref(false)
const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

const results = computed<ToolManifest[]>(() => {
  const q = query.value.trim()
  const recent = navStore.recentTools
  if (!q) {
    const recentTools = recent
      .map((id) => toolRegistry.get(id))
      .filter((tool): tool is ToolManifest => Boolean(tool))
    const rest = toolRegistry.getAll().filter((tool) => !recent.includes(tool.id))
    return [...recentTools, ...rest]
  }
  return toolRegistry.search(q, recent)
})

function isRecent(tool: ToolManifest): boolean {
  return navStore.recentTools.includes(tool.id)
}

watch(query, () => {
  selectedIndex.value = 0
})

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    query.value = ''
    selectedIndex.value = 0
    nextTick(() => inputRef.value?.focus())
  }
}

function selectTool(tool: ToolManifest) {
  navStore.exitSettings()
  tabStore.openTool(tool.id)
  navStore.addRecent(tool.id)
  isOpen.value = false
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (results.value.length > 0) {
      selectedIndex.value = (selectedIndex.value + 1) % results.value.length
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (results.value.length > 0) {
      selectedIndex.value = (selectedIndex.value - 1 + results.value.length) % results.value.length
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (results.value[selectedIndex.value]) {
      selectTool(results.value[selectedIndex.value])
    }
  } else if (e.key === 'Escape') {
    e.preventDefault()
    isOpen.value = false
  }
}

function onGlobalToggle() {
  toggle()
}

function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    toggle()
  }
}

onMounted(() => {
  window.addEventListener('toggle-search', onGlobalToggle)
  window.addEventListener('keydown', onGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('toggle-search', onGlobalToggle)
  window.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="isOpen"
        data-search-palette
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
        class="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] select-none"
        style="background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);"
        @click.self="isOpen = false"
      >
        <div
          class="glass-panel w-full max-w-[560px] rounded-2xl border overflow-hidden shadow-2xl transition-all"
          style="
            background: var(--panel-strong-bg);
            border-color: var(--panel-border);
            box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          "
        >
          <!-- Search Input Bar -->
          <div class="flex items-center gap-3 px-4 py-3.5 border-b" style="border-color: var(--color-border-muted)">
            <svg class="w-4 h-4 shrink-0 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref="inputRef"
              v-model="query"
              class="flex-1 bg-transparent outline-none text-sm placeholder:text-zinc-500"
              style="color: var(--color-text-primary)"
              placeholder="搜索任何工具、分类或关键词..."
              @keydown="handleKeydown"
            />
            <span class="kbd-badge">ESC</span>
          </div>

          <!-- Tool Results List -->
          <div class="max-h-[340px] overflow-y-auto p-2 space-y-1">
            <div
              v-if="results.length === 0"
              class="px-4 py-10 text-center text-xs text-zinc-500"
            >
              未找到与 "{{ query }}" 匹配的工具
            </div>

            <button
              v-for="(tool, index) in results"
              :key="tool.id"
              class="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all"
              :style="{
                background: index === selectedIndex ? 'var(--color-accent-muted)' : 'transparent',
                border: index === selectedIndex ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent'
              }"
              @click="selectTool(tool)"
              @mouseenter="selectedIndex = index"
            >
              <!-- Icon Box -->
              <div
                class="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0"
                style="background: var(--control-bg); color: var(--color-text-secondary)"
              >
                {{ tool.icon }}
              </div>

              <!-- Tool Text -->
              <div class="flex-1 min-w-0">
                <div class="text-xs font-medium truncate" style="color: var(--color-text-primary)">
                  {{ tool.name }}
                </div>
                <div class="text-[11px] truncate text-zinc-400">
                  {{ tool.description }}
                </div>
              </div>

              <!-- Category Tag -->
              <span class="text-[10px] font-mono px-2 py-0.5 rounded-md text-zinc-400 shrink-0" style="background: var(--control-bg)">
                {{ categoryName(tool.category) }}
              </span>

              <span v-if="!query.trim() && isRecent(tool)" class="text-[10px] shrink-0 text-amber-400/80">最近</span>

              <!-- Enter indicator -->
              <svg
                v-if="index === selectedIndex"
                class="w-3.5 h-3.5 shrink-0 text-indigo-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>

          <!-- Footer Hints (Raycast style) -->
          <div
            class="flex items-center justify-between px-4 py-2 border-t text-[11px]"
            style="border-color: var(--panel-border); color: var(--color-text-tertiary); background: var(--panel-strong-bg)"
          >
            <div class="flex items-center gap-3">
              <span class="flex items-center gap-1"><span class="kbd-badge">↑↓</span> 导航</span>
              <span class="flex items-center gap-1"><span class="kbd-badge">↵</span> 打开</span>
              <span class="flex items-center gap-1"><span class="kbd-badge">ESC</span> 退出</span>
            </div>
            <span class="font-mono text-[10px]">{{ results.length }} 个结果</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
