<script setup lang="ts">
import type { DailyTimeSummary } from '@shared/timeCoach'
import { formatDuration } from '../constants'

defineProps<{
  summary: DailyTimeSummary | null
}>()
</script>

<template>
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <div
      class="rounded-xl border p-3.5"
      style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
    >
      <div class="text-[11px]" style="color: var(--color-text-tertiary)">有效工作时长</div>
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
      <div class="text-[11px]" style="color: var(--color-text-tertiary)">摸鱼休闲 / 离开闲置</div>
      <div class="mt-1.5 flex items-baseline gap-2">
        <span class="text-xl font-semibold tracking-tight text-emerald-400">
          {{ formatDuration(summary?.leisureSec ?? 0) }}
        </span>
        <span class="text-xs" style="color: var(--color-text-tertiary)">
          / {{ formatDuration(summary?.idleSec ?? 0) }}
        </span>
      </div>
      <div class="mt-1 text-[11px]" style="color: var(--color-text-tertiary)">
        劳逸结合，保持节奏
      </div>
    </div>
  </div>
</template>
