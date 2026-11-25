<script setup lang="ts">
import { useNavStore, useTabStore } from '../stores'
import { categories } from '../stores/navStore'
import { toolRegistry } from '../registry'
import type { ToolCategory, WorkspaceItem } from '@shared/types'
import { computed } from 'vue'

const navStore = useNavStore()
const tabStore = useTabStore()

const workspaceItems: { id: WorkspaceItem; name: string; icon: string }[] = [
  { id: 'home', name: '首页', icon: 'home' },
  { id: 'all', name: '全部工具', icon: 'squares' },
  { id: 'favorites', name: '我的收藏', icon: 'star' },
  { id: 'recent', name: '最近使用', icon: 'clock' }
]

const categoryIcons: Record<string, string> = {
  'code-bracket': 'M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5',
  'globe-alt': 'M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418',
  'photo': 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z',
  'folder': 'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z',
  'lock-closed': 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z',
  'sparkles': 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z',
  'computer-desktop': 'M9 17.25v1.5H6.75v1.5h10.5v-1.5H15v-1.5M4.5 3.75h15A2.25 2.25 0 0 1 21.75 6v9A2.25 2.25 0 0 1 19.5 17.25h-15A2.25 2.25 0 0 1 2.25 15V6A2.25 2.25 0 0 1 4.5 3.75Z'
}

function getCategoryToolCount(cat: ToolCategory): number {
  return toolRegistry.getByCategory(cat).length
}

function getWorkspaceBadge(item: WorkspaceItem): number | null {
  if (item === 'all') return toolRegistry.getAll().length
  if (item === 'favorites') return navStore.favorites.size
  if (item === 'recent') return navStore.recentTools.length
  return null
}

function isCategoryCollapsed(cat: ToolCategory): boolean {
  return navStore.collapsedCategories.has(cat)
}

function handleToolClick(toolId: string): void {
  navStore.exitSettings()
  tabStore.openTool(toolId)
  navStore.addRecent(toolId)
}

function openSettings(): void {
  navStore.setWorkspace('settings')
}
</script>

<template>
  <aside
    class="flex flex-col shrink-0 border-r select-none transition-all duration-200"
    :style="{
      width: navStore.sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
      background: 'var(--shell-bg)',
      borderColor: 'var(--color-border-muted)',
      backdropFilter: 'blur(16px)'
    }"
  >
    <!-- Top Bar / Collapse Toggle -->
    <div class="flex items-center justify-between px-3 h-10 shrink-0 border-b" style="border-color: var(--color-border-muted)">
      <span
        v-if="!navStore.sidebarCollapsed"
        class="text-[10px] font-bold uppercase tracking-widest"
        style="color: var(--color-text-tertiary)"
      >
        导航工作区
      </span>
      <button
        class="w-7 h-7 flex items-center justify-center rounded-md transition-colors hover:bg-white/[0.08]"
        :class="{ 'mx-auto': navStore.sidebarCollapsed }"
        style="color: var(--color-text-tertiary)"
        :title="navStore.sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'"
        @click="navStore.toggleSidebar()"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
          <path v-if="navStore.sidebarCollapsed" stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          <path v-else stroke-linecap="round" stroke-linejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
        </svg>
      </button>
    </div>

    <!-- Expanded View -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-4" v-show="!navStore.sidebarCollapsed">
      <!-- Workspace Navigation -->
      <div>
        <div class="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 text-zinc-500">
          工作空间
        </div>
        <div class="space-y-0.5">
          <button
            v-for="item in workspaceItems"
            :key="item.id"
            class="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all group"
            :style="{
              background: navStore.activeWorkspace === item.id && !navStore.activeCategory
                ? 'var(--color-accent-muted)'
                : 'transparent',
              color: navStore.activeWorkspace === item.id && !navStore.activeCategory
                ? 'var(--color-text-primary)'
                : 'var(--color-text-secondary)'
            }"
            @click="navStore.setWorkspace(item.id)"
          >
            <!-- Icons -->
            <svg v-if="item.icon === 'home'" class="w-4 h-4 shrink-0 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <svg v-else-if="item.icon === 'squares'" class="w-4 h-4 shrink-0 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
            </svg>
            <svg v-else-if="item.icon === 'star'" class="w-4 h-4 shrink-0 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
            </svg>
            <svg v-else-if="item.icon === 'clock'" class="w-4 h-4 shrink-0 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>

            <span class="flex-1 text-left truncate">{{ item.name }}</span>

            <span
              v-if="getWorkspaceBadge(item.id) !== null"
              class="text-[10px] font-mono px-1.5 py-0.2 rounded-full font-medium"
              style="background: var(--color-bg-muted); color: var(--color-text-tertiary)"
            >
              {{ getWorkspaceBadge(item.id) }}
            </span>
          </button>
        </div>
      </div>

      <!-- Categories Section (Dynamic & Expandable) -->
      <div>
        <div class="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 text-zinc-500">
          工具分类
        </div>
        <div class="space-y-1">
          <div v-for="cat in categories" :key="cat.id" class="space-y-0.5">
            <!-- Category Header -->
            <button
              class="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all group"
              :style="{
                background: navStore.activeCategory === cat.id
                  ? 'var(--color-accent-muted)'
                  : 'transparent',
                color: navStore.activeCategory === cat.id
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-secondary)'
              }"
              @click="navStore.setCategory(cat.id)"
            >
              <svg class="w-4 h-4 shrink-0 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" :d="categoryIcons[cat.icon] || ''" />
              </svg>
              <span class="flex-1 text-left truncate">{{ cat.name }}</span>

              <span
                class="text-[10px] font-mono px-1.5 py-0.2 rounded-full font-medium mr-1"
                style="background: var(--color-bg-muted); color: var(--color-text-tertiary)"
              >
                {{ getCategoryToolCount(cat.id) }}
              </span>

              <!-- Chevron collapse -->
              <div
                class="w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 transition-transform duration-150"
                :class="{ '-rotate-90': isCategoryCollapsed(cat.id) }"
                @click.stop="navStore.toggleCategoryCollapse(cat.id)"
              >
                <svg class="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </button>

            <!-- Sub Tools under this category -->
            <div
              v-if="!isCategoryCollapsed(cat.id) && toolRegistry.getByCategory(cat.id).length > 0"
              class="ml-5 pl-2 border-l space-y-0.5"
              style="border-color: var(--color-border-muted)"
            >
              <button
                v-for="tool in toolRegistry.getByCategory(cat.id)"
                :key="tool.id"
                class="flex items-center gap-2 w-full px-2 py-1 rounded-md text-[11px] transition-colors hover:bg-white/[0.04]"
                style="color: var(--color-text-secondary)"
                @click="handleToolClick(tool.id)"
              >
                <span class="text-xs opacity-70">{{ tool.icon }}</span>
                <span class="truncate">{{ tool.name }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Collapsed View (Slim Icon Strip) -->
    <div class="flex-1 flex flex-col items-center pt-2 gap-1.5" v-show="navStore.sidebarCollapsed">
      <button
        v-for="item in workspaceItems"
        :key="item.id"
        class="w-9 h-9 flex items-center justify-center rounded-lg transition-all"
        :style="{
          background: navStore.activeWorkspace === item.id && !navStore.activeCategory
            ? 'var(--color-accent-muted)'
            : 'transparent',
          color: navStore.activeWorkspace === item.id && !navStore.activeCategory
            ? 'var(--color-accent-hover)'
            : 'var(--color-text-secondary)'
        }"
        :title="item.name"
        @click="navStore.setWorkspace(item.id)"
      >
        <svg v-if="item.icon === 'home'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
        <svg v-else-if="item.icon === 'squares'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
        </svg>
        <svg v-else-if="item.icon === 'star'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
        </svg>
        <svg v-else-if="item.icon === 'clock'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </button>

      <div class="w-6 h-px my-1" style="background: var(--color-border-muted)"></div>

      <button
        v-for="cat in categories"
        :key="cat.id"
        class="w-9 h-9 flex items-center justify-center rounded-lg transition-all"
        :style="{
          background: navStore.activeCategory === cat.id
            ? 'var(--color-accent-muted)'
            : 'transparent',
          color: navStore.activeCategory === cat.id
            ? 'var(--color-accent-hover)'
            : 'var(--color-text-secondary)'
        }"
        :title="cat.name"
        @click="navStore.setCategory(cat.id)"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" :d="categoryIcons[cat.icon] || ''" />
        </svg>
      </button>
    </div>

    <!-- Bottom Settings Bar -->
    <div class="shrink-0 border-t p-2" style="border-color: var(--color-border-muted)">
      <button
        class="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/[0.06]"
        :class="{ 'justify-center': navStore.sidebarCollapsed }"
        :style="{
          background: navStore.isSettings ? 'var(--color-accent-muted)' : 'transparent',
          color: navStore.isSettings ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'
        }"
        title="应用偏好设置"
        @click="openSettings"
      >
        <svg class="w-4 h-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
        <span v-if="!navStore.sidebarCollapsed" class="truncate">系统设置</span>
      </button>
    </div>
  </aside>
</template>
