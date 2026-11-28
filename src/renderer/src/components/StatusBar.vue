<script setup lang="ts">
import { useTabStore } from '../stores'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { TimeCoachStatus } from '@shared/timeCoach'
import { formatDuration } from '../tools/system/time-coach/constants'

defineProps<{ disguise: boolean }>()

const tabStore = useTabStore()
const timeCoachStatus = ref<TimeCoachStatus | null>(null)
let unsubscribeTimeCoach: (() => void) | null = null

const currentToolName = computed(() => {
  return tabStore.activeTab?.name ?? null
})

function openTimeCoach(): void {
  tabStore.openTool('time-coach')
}

onMounted(() => {
  if (window.api?.timeCoach) {
    void window.api.timeCoach.getStatus().then((st) => {
      timeCoachStatus.value = st
    })
    unsubscribeTimeCoach = window.api.timeCoach.onStatusChanged((st) => {
      timeCoachStatus.value = st
    })
  }
})

onBeforeUnmount(() => {
  unsubscribeTimeCoach?.()
})
</script>

<template>
  <footer
    class="flex items-center justify-between shrink-0 border-t select-none text-[11px]"
    :style="{
      height: 'var(--statusbar-height)',
      background: disguise ? '#007acc' : 'var(--shell-bg)',
      borderColor: disguise ? 'transparent' : 'var(--color-border-muted)',
      color: disguise ? '#ffffff' : 'var(--color-text-tertiary)'
    }"
  >
    <template v-if="disguise">
      <div class="flex items-center gap-3">
        <span class="flex items-center gap-1.5">
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <circle cx="6" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="8" r="2" /><path d="M6 8v8m0-2c0-4 12-2 12-7" />
          </svg>
          main*
        </span>
        <span class="flex items-center gap-1.5">
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 12a8 8 0 0 1 13.5-5.8L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.5 5.8L4 15.5M4 20v-4.5h4.5" />
          </svg>
        </span>
        <span>⊗ 0</span>
        <span>△ 0</span>
      </div>
      <div class="flex items-center gap-3">
        <span>Ln 1, Col 1</span>
        <span>Spaces: 2</span>
        <span>UTF-8</span>
        <span>LF</span>
        <span>{ } TypeScript</span>
        <span>✓ Prettier</span>
        <span title="通知">
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 8H3c0-1 3-1 3-8Zm4 11h4" />
          </svg>
        </span>
      </div>
    </template>

    <template v-else>
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

      <div class="hidden md:flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
        <span>按下</span>
        <span class="kbd-badge">Ctrl</span>
        <span class="kbd-badge">K</span>
        <span>呼出全局命令面板</span>
      </div>

      <div class="flex items-center gap-3 font-mono">
        <button
          v-if="timeCoachStatus && timeCoachStatus.state !== 'stopped'"
          type="button"
          class="flex items-center gap-1.5 rounded px-1.5 py-0.5 transition hover:bg-white/10"
          :title="timeCoachStatus.breakReminderDue ? '连续专注较久，建议休息一下' : '点击打开工作统计'"
          @click="openTimeCoach"
        >
          <span
            class="h-1.5 w-1.5 rounded-full"
            :style="{
              background:
                timeCoachStatus.state === 'active'
                  ? 'var(--color-success)'
                  : 'var(--color-warning)'
            }"
          />
          <span>
            工作 {{ formatDuration(timeCoachStatus.todayWorkSec) }} · 摸鱼 {{ formatDuration(timeCoachStatus.todayLeisureSec ?? 0) }}
          </span>
        </button>
        <span v-if="timeCoachStatus && timeCoachStatus.state !== 'stopped'" class="text-zinc-700">|</span>
        <span>已打开标签: {{ tabStore.tabs.length }}</span>
        <span class="text-zinc-700">|</span>
        <span>v1.0.0</span>
      </div>
    </template>
  </footer>
</template>
