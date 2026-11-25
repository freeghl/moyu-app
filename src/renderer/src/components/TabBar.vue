<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useNavStore, useTabStore } from '../stores'

const tabStore = useTabStore()
const navStore = useNavStore()

const menu = ref<{ x: number; y: number; tabId: string } | null>(null)
const draggingId = ref<string | null>(null)

const menuItems = computed(() => {
  if (!menu.value) return []
  return [
    { label: '关闭', run: () => tabStore.closeTab(menu.value!.tabId) },
    { label: '关闭其他', run: () => tabStore.closeOthers(menu.value!.tabId) },
    { label: '关闭全部', run: () => tabStore.closeAll() }
  ]
})

function openSearch(): void {
  window.dispatchEvent(new CustomEvent('toggle-search'))
}

function switchTab(tabId: string): void {
  navStore.exitSettings()
  tabStore.switchTab(tabId)
}

function openMenu(event: MouseEvent, tabId: string): void {
  event.preventDefault()
  navStore.exitSettings()
  tabStore.switchTab(tabId)
  const width = 132
  const height = 140
  menu.value = {
    tabId,
    x: Math.min(event.clientX, window.innerWidth - width - 8),
    y: Math.min(event.clientY, window.innerHeight - height - 8)
  }
}

function closeMenu(): void {
  menu.value = null
}

function runMenu(action: () => void): void {
  action()
  menu.value = null
}

function onDragStart(event: DragEvent, tabId: string): void {
  draggingId.value = tabId
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', tabId)
  }
  closeMenu()
}

function onDrop(index: number): void {
  if (!draggingId.value) return
  tabStore.reorderTab(draggingId.value, index)
  draggingId.value = null
}

onMounted(() => window.addEventListener('pointerdown', closeMenu))
onBeforeUnmount(() => window.removeEventListener('pointerdown', closeMenu))
</script>

<template>
  <div
    class="flex items-end shrink-0 overflow-x-auto border-b select-none"
    style="
      height: var(--tabbar-height);
      background: var(--shell-bg);
      border-color: var(--color-border-muted);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    "
    v-show="tabStore.tabs.length > 0"
  >
    <div class="flex items-end flex-1 min-w-0 overflow-x-auto">
      <div
        v-for="(tab, index) in tabStore.tabs"
        :key="tab.id"
        class="flex items-center gap-2 px-3 h-[36px] shrink-0 cursor-pointer transition-all group border-r relative"
        :class="[tab.isActive ? 'shadow-sm' : 'hover:bg-white/[0.03]', draggingId === tab.id ? 'opacity-40' : '']"
        :style="{
          maxWidth: '220px',
          background: tab.isActive ? 'var(--tab-active-bg, var(--color-bg-base))' : 'transparent',
          borderColor: 'var(--color-border-muted)',
          color: tab.isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'
        }"
        draggable="true"
        @click="switchTab(tab.id)"
        @auxclick.stop="tabStore.closeTab(tab.id)"
        @contextmenu="openMenu($event, tab.id)"
        @dragstart="onDragStart($event, tab.id)"
        @dragover.prevent
        @drop.prevent="onDrop(index)"
        @dragend="draggingId = null"
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
          title="关闭标签页 (Ctrl + W)"
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

    <!-- Tab context menu -->
    <Teleport to="body">
      <div
        v-if="menu"
        class="fixed z-[60] w-[132px] rounded-lg border p-1 text-xs shadow-2xl"
        style="background: var(--color-bg-surface); border-color: var(--color-border-default)"
        @pointerdown.stop
        @contextmenu.prevent
      >
        <button
          v-for="item in menuItems"
          :key="item.label"
          type="button"
          class="w-full cursor-pointer rounded px-2 py-1.5 text-left transition-colors hover:bg-(--color-bg-overlay)"
          style="color: var(--color-text-secondary)"
          @click="runMenu(item.run)"
        >
          {{ item.label }}
        </button>
        <div class="my-1 h-px" style="background: var(--color-border-muted)"></div>
        <button
          type="button"
          class="w-full cursor-pointer rounded px-2 py-1.5 text-left transition-colors hover:bg-(--color-bg-overlay)"
          style="color: var(--color-text-tertiary)"
          @click="runMenu(() => tabStore.reopenClosed())"
        >
          恢复关闭的标签
        </button>
      </div>
    </Teleport>
  </div>
</template>
