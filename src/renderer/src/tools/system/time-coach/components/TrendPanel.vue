<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { TrendPoint } from '@shared/timeCoach'
import { CATEGORY_META, formatDuration } from '../constants'

const props = defineProps<{
  active: boolean
}>()

const days = ref<7 | 30>(7)
const loading = ref(false)
const points = ref<TrendPoint[]>([])

const maxWorkSec = computed(() =>
  Math.max(3600, ...points.value.map((p) => p.totalWorkSec + p.leisureSec))
)

const totals = computed(() => {
  const work = points.value.reduce((s, p) => s + p.totalWorkSec, 0)
  const focus = points.value.reduce((s, p) => s + p.focusSec, 0)
  const leisure = points.value.reduce((s, p) => s + p.leisureSec, 0)
  const activeDays = points.value.filter((p) => p.totalWorkSec > 0).length
  return { work, focus, leisure, activeDays }
})

async function loadTrends(): Promise<void> {
  if (!window.api?.timeCoach) return
  loading.value = true
  try {
    points.value = await window.api.timeCoach.getTrends(days.value)
  } finally {
    loading.value = false
  }
}

function barHeight(sec: number): string {
  const pct = Math.min(100, (sec / maxWorkSec.value) * 100)
  return `${pct.toFixed(1)}%`
}

watch(days, () => {
  void loadTrends()
})

watch(
  () => props.active,
  (isActive) => {
    if (isActive) void loadTrends()
  }
)

onMounted(() => {
  void loadTrends()
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold" style="color: var(--color-text-primary)">历史工作与专注趋势</h3>
        <p class="text-xs" style="color: var(--color-text-tertiary)">
          近 {{ days }} 天累计有效工作 {{ formatDuration(totals.work) }}，净专注 {{ formatDuration(totals.focus) }}（活跃 {{ totals.activeDays }} 天）
        </p>
      </div>
      <div class="flex items-center gap-1.5 rounded-lg border p-1" style="border-color: var(--color-border-muted); background: var(--color-bg-elevated)">
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs transition"
          :style="days === 7 ? 'background: var(--color-accent); color: #fff' : 'color: var(--color-text-secondary)'"
          @click="days = 7"
        >
          近 7 天
        </button>
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs transition"
          :style="days === 30 ? 'background: var(--color-accent); color: #fff' : 'color: var(--color-text-secondary)'"
          @click="days = 30"
        >
          近 30 天
        </button>
      </div>
    </div>

    <div
      class="rounded-xl border p-4"
      style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
    >
      <div v-if="loading" class="py-12 text-center text-xs" style="color: var(--color-text-tertiary)">
        正在加载趋势数据...
      </div>

      <div v-else class="space-y-3">
        <div class="flex h-44 items-end gap-1.5 pt-4">
          <div
            v-for="p in points"
            :key="p.date"
            class="group flex flex-1 flex-col items-center gap-1.5 h-full justify-end"
            :title="`${p.date}\n深度工作: ${formatDuration(p.categoryTotals.deep_work)}\n调研文档: ${formatDuration(p.categoryTotals.research)}\n沟通协作: ${formatDuration(p.categoryTotals.communication)}\n摸鱼休息: ${formatDuration(p.leisureSec)}`"
          >
            <div class="flex w-full max-w-[28px] flex-1 flex-col justify-end overflow-hidden rounded-t-md bg-zinc-800/40">
              <div
                class="w-full transition-all"
                :style="{ height: barHeight(p.leisureSec), background: CATEGORY_META.leisure.color }"
              />
              <div
                class="w-full transition-all"
                :style="{ height: barHeight(p.categoryTotals.communication), background: CATEGORY_META.communication.color }"
              />
              <div
                class="w-full transition-all"
                :style="{ height: barHeight(p.categoryTotals.research), background: CATEGORY_META.research.color }"
              />
              <div
                class="w-full transition-all"
                :style="{ height: barHeight(p.categoryTotals.deep_work), background: CATEGORY_META.deep_work.color }"
              />
            </div>
            <span class="text-[10px] tabular-nums" style="color: var(--color-text-tertiary)">
              {{ p.date.slice(5) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div
      class="overflow-hidden rounded-xl border"
      style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
    >
      <table class="w-full text-left text-xs">
        <thead class="border-b text-[11px]" style="border-color: var(--color-border-muted); color: var(--color-text-tertiary)">
          <tr>
            <th class="px-3.5 py-2.5 font-medium">日期</th>
            <th class="px-3.5 py-2.5 font-medium">有效工作</th>
            <th class="px-3.5 py-2.5 font-medium">净专注</th>
            <th class="px-3.5 py-2.5 font-medium">最长连续</th>
            <th class="px-3.5 py-2.5 font-medium">摸鱼休闲</th>
            <th class="px-3.5 py-2.5 font-medium">切换次数</th>
          </tr>
        </thead>
        <tbody class="divide-y" style="border-color: var(--color-border-muted)">
          <tr v-for="p in [...points].reverse()" :key="p.date">
            <td class="px-3.5 py-2 font-mono" style="color: var(--color-text-primary)">{{ p.date }}</td>
            <td class="px-3.5 py-2" style="color: var(--color-text-primary)">{{ formatDuration(p.totalWorkSec) }}</td>
            <td class="px-3.5 py-2 text-indigo-400">{{ formatDuration(p.focusSec) }}</td>
            <td class="px-3.5 py-2" style="color: var(--color-text-secondary)">{{ formatDuration(p.longestFocusSec) }}</td>
            <td class="px-3.5 py-2 text-emerald-400">{{ formatDuration(p.leisureSec) }}</td>
            <td class="px-3.5 py-2" style="color: var(--color-text-secondary)">{{ p.switchCount }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
