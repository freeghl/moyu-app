<script setup lang="ts">
import { computed } from 'vue'
import type { DailyTimeSummary } from '@shared/timeCoach'
import { formatDuration } from '../constants'

const props = defineProps<{
  summary: DailyTimeSummary | null
}>()

const workPct = computed(() => {
  const total = props.summary?.totalActiveSec ?? 0
  if (total <= 0) return 0
  return Math.round(((props.summary?.totalWorkSec ?? 0) / total) * 100)
})

const moyuPct = computed(() => {
  const total = props.summary?.totalActiveSec ?? 0
  if (total <= 0) return 0
  return Math.round(((props.summary?.leisureSec ?? 0) / total) * 100)
})

const moyuTag = computed(() => {
  const total = props.summary?.totalActiveSec ?? 0
  if (total <= 0) return { text: '等待统计', color: '#a1a1aa', bg: 'rgba(113, 113, 122, 0.16)' }
  const pct = moyuPct.value
  if (pct <= 10) return { text: '全神贯注', color: '#818cf8', bg: 'rgba(99, 102, 241, 0.16)' }
  if (pct <= 25) return { text: '劳逸结合', color: '#34d399', bg: 'rgba(16, 185, 129, 0.16)' }
  if (pct <= 45) return { text: '适度摸鱼', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.16)' }
  return { text: '摸鱼大师', color: '#f472b6', bg: 'rgba(236, 72, 153, 0.16)' }
})
</script>

<template>
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <div
      class="rounded-xl border p-3.5"
      style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
    >
      <div class="flex items-center justify-between text-[11px]" style="color: var(--color-text-tertiary)">
        <span>有效工作时长</span>
        <span class="font-mono">占比 {{ workPct }}%</span>
      </div>
      <div class="mt-1.5 text-xl font-semibold tracking-tight" style="color: var(--color-text-primary)">
        {{ formatDuration(summary?.totalWorkSec ?? 0) }}
      </div>
      <div class="mt-1 text-[11px]" style="color: var(--color-text-tertiary)">
        编码 + 调研 + 沟通
      </div>
    </div>

    <div
      class="rounded-xl border p-3.5"
      style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
    >
      <div class="text-[11px]" style="color: var(--color-text-tertiary)">净专注 / 最长连续</div>
      <div class="mt-1.5 flex items-baseline gap-2">
        <span class="text-xl font-semibold tracking-tight text-indigo-400">
          {{ formatDuration(summary?.focusSec ?? 0) }}
        </span>
        <span class="text-xs" style="color: var(--color-text-tertiary)">
          / {{ formatDuration(summary?.longestFocusSec ?? 0) }}
        </span>
      </div>
      <div class="mt-1 text-[11px]" style="color: var(--color-text-tertiary)">
        专注会话 {{ summary?.focusSessions.length ?? 0 }} 段
      </div>
    </div>

    <div
      class="rounded-xl border p-3.5"
      style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
    >
      <div class="text-[11px]" style="color: var(--color-text-tertiary)">应用切换次数</div>
      <div class="mt-1.5 text-xl font-semibold tracking-tight text-amber-400">
        {{ summary?.switchCount ?? 0 }}
        <span class="text-xs font-normal" style="color: var(--color-text-tertiary)">次</span>
      </div>
      <div class="mt-1 text-[11px]" style="color: var(--color-text-tertiary)">
        越低代表上下文越连贯
      </div>
    </div>

    <div
      class="rounded-xl border p-3.5"
      style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
    >
      <div class="flex items-center justify-between text-[11px]" style="color: var(--color-text-tertiary)">
        <span>摸鱼休闲 / 离开闲置</span>
        <span
          class="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
          :style="{ background: moyuTag.bg, color: moyuTag.color }"
        >
          {{ moyuTag.text }}
        </span>
      </div>
      <div class="mt-1.5 flex items-baseline gap-2">
        <span class="text-xl font-semibold tracking-tight text-emerald-400">
          {{ formatDuration(summary?.leisureSec ?? 0) }}
        </span>
        <span class="text-xs" style="color: var(--color-text-tertiary)">
          / {{ formatDuration(summary?.idleSec ?? 0) }}
        </span>
      </div>
      <div class="mt-1 text-[11px]" style="color: var(--color-text-tertiary)">
        摸鱼率 {{ moyuPct }}% · 劳逸结合
      </div>
    </div>
  </div>
</template>
