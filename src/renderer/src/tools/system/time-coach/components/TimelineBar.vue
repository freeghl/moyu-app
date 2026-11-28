<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ActivityCategory, ActivitySegment } from '@shared/timeCoach'
import { CATEGORY_LIST, CATEGORY_META, formatClock, formatDuration } from '../constants'

const props = defineProps<{
  segments: ActivitySegment[]
  date: string
}>()

const emit = defineEmits<{
  reclassify: [
    payload: { segmentId: string; appName?: string; category: ActivityCategory; applyToApp: boolean; createRule: boolean }
  ]
}>()

const hovered = ref<ActivitySegment | null>(null)
const selected = ref<ActivitySegment | null>(null)
const applyToApp = ref(false)
const createRule = ref(false)

const visibleSegments = computed(() =>
  props.segments.filter((s) => s.durationSec >= 3 && (s.state === 'active' || s.state === 'idle'))
)

const rangeBounds = computed(() => {
  if (!visibleSegments.value.length) {
    return { start: 0, end: 1 }
  }
  const start = visibleSegments.value[0].startAt
  const end = Math.max(
    start + 60_000,
    visibleSegments.value[visibleSegments.value.length - 1].endAt
  )
  return { start, end }
})

function segmentStyle(seg: ActivitySegment): Record<string, string> {
  const total = Math.max(1, rangeBounds.value.end - rangeBounds.value.start)
  const left = ((seg.startAt - rangeBounds.value.start) / total) * 100
  const width = Math.max(0.4, ((seg.endAt - seg.startAt) / total) * 100)
  const color =
    seg.state === 'idle'
      ? '#3f3f46'
      : CATEGORY_META[seg.category ?? 'other'].color
  return {
    left: `${left}%`,
    width: `${width}%`,
    background: color
  }
}

function segmentLabel(seg: ActivitySegment): string {
  if (seg.state === 'idle') return '离开 / 闲置'
  const cat = CATEGORY_META[seg.category ?? 'other'].label
  const app = seg.category === 'private' ? '隐私应用' : (seg.appName || '未知应用')
  return `${app} · ${cat}`
}

function selectSegment(seg: ActivitySegment): void {
  if (seg.state !== 'active') return
  selected.value = seg
  applyToApp.value = false
  createRule.value = false
}

function applyCategory(category: ActivityCategory): void {
  if (!selected.value) return
  emit('reclassify', {
    segmentId: selected.value.id,
    appName: selected.value.appName,
    category,
    applyToApp: applyToApp.value,
    createRule: createRule.value
  })
  selected.value = null
}
</script>

<template>
  <div
    class="rounded-xl border p-4 space-y-3"
    style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="text-xs font-semibold" style="color: var(--color-text-primary)">
          全天活动时间轴
          <span v-if="visibleSegments.length" class="ml-1.5 font-normal text-[11px]" style="color: var(--color-text-tertiary)">
            ({{ visibleSegments.length }} 段)
          </span>
        </h3>
        <p class="text-[11px]" style="color: var(--color-text-tertiary)">
          点击任意色块可手动修正分类或设为隐私黑名单
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3 text-[11px]" style="color: var(--color-text-secondary)">
        <span v-for="cat in CATEGORY_LIST" :key="cat.id" class="flex items-center gap-1">
          <span class="inline-block h-2 w-2 rounded-full" :style="{ background: cat.color }" />
          {{ cat.label }}
        </span>
        <span class="flex items-center gap-1">
          <span class="inline-block h-2 w-2 rounded-full bg-zinc-700" />
          闲置
        </span>
      </div>
    </div>

    <div
      v-if="visibleSegments.length === 0"
      class="flex h-12 items-center justify-center rounded-lg border border-dashed text-xs"
      style="border-color: var(--color-border-default); color: var(--color-text-tertiary)"
    >
      {{ date }} 暂无活动记录
    </div>

    <template v-else>
      <div
        class="relative h-9 w-full overflow-hidden rounded-lg border"
        style="background: var(--color-bg-base); border-color: var(--color-border-muted)"
      >
        <button
          v-for="seg in visibleSegments"
          :key="seg.id"
          type="button"
          class="absolute top-0 bottom-0 transition-opacity hover:opacity-80 focus:outline-none"
          :class="selected?.id === seg.id ? 'ring-2 ring-white/90 z-10' : ''"
          :style="segmentStyle(seg)"
          :title="`${formatClock(seg.startAt)}-${formatClock(seg.endAt)} ${segmentLabel(seg)} (${formatDuration(seg.durationSec)})`"
          @mouseenter="hovered = seg"
          @mouseleave="hovered = null"
          @click="selectSegment(seg)"
        />
      </div>

      <div class="flex items-center justify-between text-[11px]" style="color: var(--color-text-tertiary)">
        <span>{{ formatClock(rangeBounds.start) }}</span>
        <span v-if="hovered" class="font-medium" style="color: var(--color-text-primary)">
          {{ formatClock(hovered.startAt) }} - {{ formatClock(hovered.endAt) }} ·
          {{ segmentLabel(hovered) }} · {{ formatDuration(hovered.durationSec) }}
        </span>
        <span>{{ formatClock(rangeBounds.end) }}</span>
      </div>
    </template>

    <!-- 人工分类修正浮层 -->
    <div
      v-if="selected"
      class="rounded-lg border p-3 space-y-2.5"
      style="background: var(--color-bg-base); border-color: var(--color-border-default)"
    >
      <div class="flex items-center justify-between text-xs">
        <span style="color: var(--color-text-primary)">
          修正片段：<strong>{{ selected.appName || '隐私应用' }}</strong>
          ({{ formatClock(selected.startAt) }} - {{ formatClock(selected.endAt) }})
        </span>
        <button
          type="button"
          class="text-[11px] hover:underline"
          style="color: var(--color-text-tertiary)"
          @click="selected = null"
        >
          取消
        </button>
      </div>

      <div v-if="selected.appName" class="flex flex-wrap items-center gap-4 text-[11px]" style="color: var(--color-text-secondary)">
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input v-model="applyToApp" type="checkbox" class="accent-indigo-500" />
          同时修正今日所有「{{ selected.appName }}」记录
        </label>
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input v-model="createRule" type="checkbox" class="accent-indigo-500" />
          保存为永久自动分类规则
        </label>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="cat in CATEGORY_LIST"
          :key="cat.id"
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition hover:opacity-85"
          :style="{ background: cat.badgeBg, color: cat.color }"
          @click="applyCategory(cat.id)"
        >
          {{ cat.label }}
        </button>
      </div>
    </div>
  </div>
</template>
