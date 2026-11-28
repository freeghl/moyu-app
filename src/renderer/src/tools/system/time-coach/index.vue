<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ActivityCategory, DailyTimeSummary, TimeCoachStatus, TrendPoint } from '@shared/timeCoach'
import {
  CATEGORY_LIST,
  CATEGORY_META,
  TRACKER_STATE_LABEL,
  formatClock,
  formatDuration,
  formatLocalDate
} from './constants'
import SummaryCards from './components/SummaryCards.vue'
import TimelineBar from './components/TimelineBar.vue'
import TrendPanel from './components/TrendPanel.vue'
import AiCoachPanel from './components/AiCoachPanel.vue'
import RuleManagerPanel from './components/RuleManagerPanel.vue'

type TabKey = 'today' | 'trends' | 'ai' | 'rules'

const activeTab = ref<TabKey>('today')
const selectedDate = ref(formatLocalDate())
const status = ref<TimeCoachStatus | null>(null)
const summary = ref<DailyTimeSummary | null>(null)
const loading = ref(false)
const actionError = ref('')
const editingAppKey = ref<string | null>(null)
const editingAppSaveRule = ref(true)
const recentActiveDates = ref<TrendPoint[]>([])
let unsubscribeStatus: (() => void) | null = null
let refreshTimer: ReturnType<typeof setInterval> | null = null

const apiAvailable = computed(() => Boolean(window.api?.timeCoach))
const isToday = computed(() => selectedDate.value === formatLocalDate())

function dateDaysAgo(daysAgo: number): string {
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo)
  return formatLocalDate(target.getTime())
}

const datePresets = computed(() => [
  { label: '今天', date: dateDaysAgo(0) },
  { label: '昨天', date: dateDaysAgo(1) },
  { label: '前天', date: dateDaysAgo(2) }
])

function shiftDate(deltaDays: number): void {
  const [y, m, d] = selectedDate.value.split('-').map(Number)
  const next = new Date(y, m - 1, d + deltaDays)
  const formatted = formatLocalDate(next.getTime())
  const today = formatLocalDate()
  selectedDate.value = formatted > today ? today : formatted
}

function goToday(): void {
  selectedDate.value = formatLocalDate()
}

const categoryBreakdown = computed(() => {
  if (!summary.value) return []
  const total = Math.max(1, summary.value.totalActiveSec)
  return CATEGORY_LIST.filter((c) => c.id !== 'private').map((cat) => {
    const sec = summary.value!.categoryTotals[cat.id] ?? 0
    return {
      ...cat,
      sec,
      pct: Math.round((sec / total) * 100)
    }
  })
})

async function loadAll(): Promise<void> {
  if (!window.api?.timeCoach) return
  loading.value = true
  try {
    const [st, sum, trends] = await Promise.all([
      window.api.timeCoach.getStatus(),
      window.api.timeCoach.getDailySummary(selectedDate.value),
      window.api.timeCoach.getTrends(30)
    ])
    status.value = st
    summary.value = sum
    recentActiveDates.value = trends
      .filter((p) => p.totalWorkSec > 0 || p.leisureSec > 0)
      .reverse()
  } finally {
    loading.value = false
  }
}

async function handleStart(): Promise<void> {
  if (!window.api?.timeCoach) {
    actionError.value = '工作统计后台接口未就绪，请重启应用窗口或重新启动 dev 服务后重试'
    return
  }
  actionError.value = ''
  try {
    status.value = await window.api.timeCoach.start()
    await loadAll()
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : String(err)
  }
}

async function handlePause(): Promise<void> {
  if (!window.api?.timeCoach) return
  actionError.value = ''
  try {
    status.value = await window.api.timeCoach.pause()
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : String(err)
  }
}

async function handleResume(): Promise<void> {
  if (!window.api?.timeCoach) return
  actionError.value = ''
  try {
    status.value = await window.api.timeCoach.resume()
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : String(err)
  }
}

async function handleStop(): Promise<void> {
  if (!window.api?.timeCoach) return
  actionError.value = ''
  try {
    status.value = await window.api.timeCoach.stop()
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : String(err)
  }
}

async function dismissBreak(): Promise<void> {
  if (!window.api?.timeCoach) return
  status.value = await window.api.timeCoach.dismissBreakReminder()
}

async function handleReclassify(payload: {
  segmentId: string
  appName?: string
  category: ActivityCategory
  applyToApp: boolean
  createRule: boolean
}): Promise<void> {
  if (!window.api?.timeCoach) return
  summary.value = await window.api.timeCoach.reclassify({
    date: selectedDate.value,
    segmentId: payload.applyToApp ? undefined : payload.segmentId,
    appName: payload.applyToApp || payload.createRule ? payload.appName : undefined,
    category: payload.category,
    createRule: payload.createRule
  })
}

async function handleReclassifyApp(appName: string, category: ActivityCategory): Promise<void> {
  if (!window.api?.timeCoach) return
  summary.value = await window.api.timeCoach.reclassify({
    date: selectedDate.value,
    appName,
    category,
    createRule: editingAppSaveRule.value
  })
  editingAppKey.value = null
}

function handleSelectDate(date: string): void {
  selectedDate.value = date
  activeTab.value = 'today'
}

watch(selectedDate, () => {
  void loadAll()
})

onMounted(() => {
  void loadAll()
  if (window.api?.timeCoach) {
    unsubscribeStatus = window.api.timeCoach.onStatusChanged((next) => {
      status.value = next
      if (isToday.value && activeTab.value === 'today') {
        void window.api!.timeCoach.getDailySummary(selectedDate.value).then((s) => {
          summary.value = s
        })
      }
    })
  }
  refreshTimer = setInterval(() => {
    if (isToday.value && status.value?.state === 'active') {
      void loadAll()
    }
  }, 15_000)
})

onBeforeUnmount(() => {
  unsubscribeStatus?.()
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <section class="flex h-full min-h-0 flex-col overflow-auto p-4 md:p-5 space-y-4">
    <!-- 顶部状态与控制栏 -->
    <header
      class="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
      style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
    >
      <div class="space-y-1">
        <div class="flex flex-wrap items-center gap-2.5">
          <h2 class="text-base font-semibold" style="color: var(--color-text-primary)">
            工作统计
          </h2>
          <span
            v-if="status"
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            :style="{
              background:
                status.state === 'active'
                  ? 'rgba(16, 185, 129, 0.16)'
                  : status.state === 'paused' || status.state === 'idle'
                    ? 'rgba(245, 158, 11, 0.16)'
                    : 'rgba(113, 113, 122, 0.16)',
              color:
                status.state === 'active'
                  ? '#34d399'
                  : status.state === 'paused' || status.state === 'idle'
                    ? '#fbbf24'
                    : '#a1a1aa'
            }"
          >
            <span
              class="h-1.5 w-1.5 rounded-full"
              :style="{
                background:
                  status.state === 'active'
                    ? '#34d399'
                    : status.state === 'paused' || status.state === 'idle'
                      ? '#fbbf24'
                      : '#a1a1aa'
              }"
            />
            {{ TRACKER_STATE_LABEL[status.state] }}
          </span>
          <span
            v-if="status?.currentAppName && status.state === 'active'"
            class="text-xs"
            style="color: var(--color-text-secondary)"
          >
            当前：{{ status.currentAppName }}
            <span v-if="status.currentCategory">({{ CATEGORY_META[status.currentCategory].label }})</span>
          </span>
        </div>
        <p class="text-xs" style="color: var(--color-text-tertiary)">
          数据 100% 本地闭环存储；默认不保存窗口标题，AI 仅接收脱敏统计摘要
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          :disabled="loading"
          class="rounded-lg border px-2.5 py-1.5 text-xs transition hover:bg-white/5 disabled:opacity-50"
          style="border-color: var(--color-border-default); color: var(--color-text-secondary); background: var(--color-bg-base)"
          title="立即刷新"
          @click="loadAll"
        >
          {{ loading ? '刷新中...' : '刷新' }}
        </button>

        <button
          v-if="!status || status.state === 'stopped'"
          type="button"
          class="rounded-lg px-3.5 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
          style="background: var(--color-accent)"
          @click="handleStart"
        >
          开启活动采集
        </button>

        <template v-else>
          <button
            v-if="status.state === 'paused'"
            type="button"
            class="rounded-lg px-3 py-1.5 text-xs font-medium text-white"
            style="background: var(--color-accent)"
            @click="handleResume"
          >
            恢复采集
          </button>
          <button
            v-else
            type="button"
            class="rounded-lg border px-3 py-1.5 text-xs font-medium"
            style="border-color: var(--color-border-default); color: var(--color-text-primary); background: var(--color-bg-base)"
            @click="handlePause"
          >
            暂停
          </button>
          <button
            type="button"
            class="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10"
            @click="handleStop"
          >
            停止
          </button>
        </template>
      </div>
    </header>

    <!-- 接口未就绪或操作异常提示 -->
    <div
      v-if="!apiAvailable || actionError"
      class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300"
    >
      {{ actionError || '工作统计后台接口（window.api.timeCoach）未就绪，请完全重启应用或重新运行 npm run dev。' }}
    </div>

    <!-- 温和防过劳提醒 -->
    <div
      v-if="status?.breakReminderDue"
      class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200"
    >
      <span>
        已连续专注 {{ formatDuration(status.currentFocusStreakSec) }}，建议起身喝口水、远眺放松 5 分钟。
      </span>
      <button
        type="button"
        class="rounded-md border border-amber-400/40 px-2.5 py-1 text-[11px] hover:bg-amber-500/20"
        @click="dismissBreak"
      >
        知道了，稍后提醒
      </button>
    </div>

    <!-- 二级导航 Tab -->
    <nav class="flex items-center gap-1.5 border-b pb-2" style="border-color: var(--color-border-muted)">
      <button
        v-for="tab in [
          { id: 'today', label: '每日概览' },
          { id: 'trends', label: '历史趋势' },
          { id: 'ai', label: 'AI 精力教练 & 日报' },
          { id: 'rules', label: '规则与隐私设置' }
        ] as const"
        :key="tab.id"
        type="button"
        class="rounded-lg px-3 py-1.5 text-xs font-medium transition"
        :style="
          activeTab === tab.id
            ? 'background: var(--color-accent); color: #fff'
            : 'color: var(--color-text-secondary)'
        "
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </nav>

    <!-- 每日概览 -->
    <div v-show="activeTab === 'today'" class="space-y-4">
      <!-- 日期筛选栏 -->
      <div
        class="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border px-3.5 py-2.5"
        style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
      >
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-medium" style="color: var(--color-text-secondary)">日期筛选</span>

          <div class="flex items-center gap-1">
            <button
              v-for="preset in datePresets"
              :key="preset.date"
              type="button"
              class="rounded-md px-2.5 py-1 text-xs transition"
              :style="
                selectedDate === preset.date
                  ? 'background: var(--color-accent); color: #fff'
                  : 'background: var(--color-bg-base); color: var(--color-text-secondary)'
              "
              @click="selectedDate = preset.date"
            >
              {{ preset.label }}
            </button>
          </div>

          <div
            class="flex items-center rounded-lg border overflow-hidden"
            style="background: var(--color-bg-base); border-color: var(--color-border-default)"
          >
            <button
              type="button"
              class="px-2 py-1 text-xs transition hover:bg-white/5"
              style="color: var(--color-text-secondary)"
              title="前一天"
              @click="shiftDate(-1)"
            >
              ‹
            </button>
            <input
              v-model="selectedDate"
              type="date"
              :max="formatLocalDate()"
              class="bg-transparent px-1.5 py-1 text-xs outline-none"
              style="color: var(--color-text-primary)"
            />
            <button
              type="button"
              :disabled="isToday"
              class="px-2 py-1 text-xs transition hover:bg-white/5 disabled:opacity-35"
              style="color: var(--color-text-secondary)"
              title="后一天"
              @click="shiftDate(1)"
            >
              ›
            </button>
          </div>

          <select
            v-if="recentActiveDates.length > 0"
            :value="recentActiveDates.some((p) => p.date === selectedDate) ? selectedDate : ''"
            class="rounded-lg border px-2.5 py-1 text-xs outline-none"
            style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
            @change="selectedDate = ($event.target as HTMLSelectElement).value"
          >
            <option value="" disabled>选择历史有记录日期...</option>
            <option v-for="p in recentActiveDates" :key="p.date" :value="p.date">
              {{ p.date }} (工作 {{ formatDuration(p.totalWorkSec) }} · 摸鱼 {{ formatDuration(p.leisureSec) }})
            </option>
          </select>
        </div>

        <div class="flex items-center gap-2 text-xs">
          <span
            v-if="!isToday"
            class="rounded-full px-2.5 py-0.5 text-[11px]"
            style="background: rgba(245, 158, 11, 0.16); color: #fbbf24"
          >
            历史概要 · {{ selectedDate }}
          </span>
          <span
            v-else
            class="rounded-full px-2.5 py-0.5 text-[11px]"
            style="background: rgba(16, 185, 129, 0.16); color: #34d399"
          >
            今日实时
          </span>
          <button
            v-if="!isToday"
            type="button"
            class="rounded-md border px-2 py-0.5 text-[11px] transition hover:bg-white/5"
            style="border-color: var(--color-border-default); color: var(--color-text-secondary)"
            @click="goToday"
          >
            回到今天
          </button>
        </div>
      </div>

      <SummaryCards :summary="summary" />

      <TimelineBar
        :segments="summary?.segments ?? []"
        :date="selectedDate"
        @reclassify="handleReclassify"
      />

      <div class="grid gap-4 lg:grid-cols-2">
        <!-- 分类时长分布 -->
        <div
          class="rounded-xl border p-4 space-y-3"
          style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
        >
          <h3 class="text-xs font-semibold" style="color: var(--color-text-primary)">分类时长占比</h3>
          <div class="space-y-2.5">
            <div v-for="item in categoryBreakdown" :key="item.id" class="space-y-1">
              <div class="flex items-center justify-between text-xs">
                <span style="color: var(--color-text-secondary)">{{ item.label }}</span>
                <span class="font-mono" style="color: var(--color-text-primary)">
                  {{ formatDuration(item.sec) }} ({{ item.pct }}%)
                </span>
              </div>
              <div class="h-1.5 w-full overflow-hidden rounded-full" style="background: var(--color-bg-base)">
                <div
                  class="h-full rounded-full transition-all"
                  :style="{ width: `${item.pct}%`, background: item.color }"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Top 应用排行 -->
        <div
          class="rounded-xl border p-4 space-y-3"
          style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-semibold" style="color: var(--color-text-primary)">Top 应用时长</h3>
            <span class="text-[11px]" style="color: var(--color-text-tertiary)">点击分类可快速修正</span>
          </div>
          <div
            v-if="!summary?.topApps.length"
            class="py-8 text-center text-xs"
            style="color: var(--color-text-tertiary)"
          >
            暂无应用统计
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="app in summary.topApps.slice(0, 8)"
              :key="`${app.appName}-${app.category}`"
              class="rounded-lg border px-3 py-2 text-xs space-y-1.5"
              style="background: var(--color-bg-base); border-color: var(--color-border-muted)"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <span
                    class="inline-block h-2 w-2 shrink-0 rounded-full"
                    :style="{ background: CATEGORY_META[app.category].color }"
                  />
                  <span class="truncate font-medium" style="color: var(--color-text-primary)">{{ app.appName }}</span>
                  <button
                    type="button"
                    class="shrink-0 rounded px-1.5 py-0.5 text-[10px] transition hover:opacity-80"
                    :style="{
                      background: CATEGORY_META[app.category].badgeBg,
                      color: CATEGORY_META[app.category].color
                    }"
                    title="点击修改该应用的分类"
                    @click="editingAppKey = editingAppKey === `${app.appName}-${app.category}` ? null : `${app.appName}-${app.category}`"
                  >
                    {{ CATEGORY_META[app.category].label }}
                  </button>
                </div>
                <span class="font-mono shrink-0" style="color: var(--color-text-secondary)">
                  {{ formatDuration(app.durationSec) }}
                  <span class="text-[10px]" style="color: var(--color-text-tertiary)">
                    ({{ Math.round((app.durationSec / Math.max(1, summary.totalActiveSec)) * 100) }}%)
                  </span>
                </span>
              </div>

              <div class="h-1 w-full overflow-hidden rounded-full" style="background: var(--color-bg-elevated)">
                <div
                  class="h-full rounded-full transition-all"
                  :style="{
                    width: `${Math.min(100, Math.round((app.durationSec / Math.max(1, summary.topApps[0].durationSec)) * 100))}%`,
                    background: CATEGORY_META[app.category].color
                  }"
                />
              </div>

              <div
                v-if="editingAppKey === `${app.appName}-${app.category}`"
                class="pt-1.5 border-t space-y-2"
                style="border-color: var(--color-border-muted)"
              >
                <div class="flex items-center justify-between text-[11px]" style="color: var(--color-text-secondary)">
                  <label class="flex items-center gap-1.5 cursor-pointer">
                    <input v-model="editingAppSaveRule" type="checkbox" class="accent-indigo-500" />
                    保存为永久分类规则
                  </label>
                  <button
                    type="button"
                    class="hover:underline"
                    style="color: var(--color-text-tertiary)"
                    @click="editingAppKey = null"
                  >
                    取消
                  </button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="cat in CATEGORY_LIST"
                    :key="cat.id"
                    type="button"
                    class="rounded px-2 py-0.5 text-[11px] font-medium transition hover:opacity-85"
                    :style="{ background: cat.badgeBg, color: cat.color }"
                    @click="handleReclassifyApp(app.appName, cat.id)"
                  >
                    {{ cat.label }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 专注会话列表 -->
      <div
        class="rounded-xl border p-4 space-y-3"
        style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
      >
        <h3 class="text-xs font-semibold" style="color: var(--color-text-primary)">
          连续专注会话（≥ 10 分钟，允许 ≤ 60 秒短中断）
        </h3>
        <div
          v-if="!summary?.focusSessions.length"
          class="py-4 text-center text-xs"
          style="color: var(--color-text-tertiary)"
        >
          今日暂未形成 ≥ 10 分钟的连续专注会话
        </div>
        <div v-else class="flex flex-wrap gap-2.5">
          <div
            v-for="fs in summary.focusSessions"
            :key="fs.id"
            class="rounded-lg border px-3 py-2 text-xs"
            style="background: var(--color-bg-base); border-color: var(--color-border-muted)"
          >
            <div class="font-mono font-medium text-indigo-400">
              {{ formatClock(fs.startAt) }} - {{ formatClock(fs.endAt) }}
            </div>
            <div class="mt-0.5 text-[11px]" style="color: var(--color-text-secondary)">
              净专注 {{ formatDuration(fs.activeDurationSec) }} · 短中断 {{ fs.interruptionCount }} 次
            </div>
          </div>
        </div>
      </div>
    </div>

    <TrendPanel v-show="activeTab === 'trends'" :active="activeTab === 'trends'" @select-date="handleSelectDate" />

    <AiCoachPanel v-show="activeTab === 'ai'" :date="selectedDate" />

    <RuleManagerPanel v-show="activeTab === 'rules'" @updated="loadAll" />
  </section>
</template>
