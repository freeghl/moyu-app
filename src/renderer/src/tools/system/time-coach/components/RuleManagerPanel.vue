<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { ActivityCategory, ActivityRule, TimeCoachSettings } from '@shared/timeCoach'
import { CATEGORY_LIST, CATEGORY_META } from '../constants'

const emit = defineEmits<{
  updated: []
}>()

const settings = ref<TimeCoachSettings | null>(null)
const rules = ref<ActivityRule[]>([])
const newName = ref('')
const newAppPattern = ref('')
const newTitleKeyword = ref('')
const newCategory = ref<ActivityCategory>('deep_work')
const newIsPrivacy = ref(false)
const confirmClear = ref(false)
const feedback = ref('')

async function loadData(): Promise<void> {
  if (!window.api?.timeCoach) return
  const [s, r] = await Promise.all([
    window.api.timeCoach.getSettings(),
    window.api.timeCoach.listRules()
  ])
  settings.value = s
  rules.value = r
}

async function updateSetting(patch: Partial<TimeCoachSettings>): Promise<void> {
  if (!window.api?.timeCoach) return
  settings.value = await window.api.timeCoach.updateSettings(patch)
  emit('updated')
}

async function addRule(): Promise<void> {
  if (!window.api?.timeCoach) return
  if (!newAppPattern.value.trim() && !newTitleKeyword.value.trim()) {
    feedback.value = '请至少填写进程名或标题关键词之一'
    return
  }
  feedback.value = ''
  rules.value = await window.api.timeCoach.saveRule({
    name: newName.value.trim() || newAppPattern.value.trim() || newTitleKeyword.value.trim(),
    appPattern: newAppPattern.value.trim() || undefined,
    titleKeyword: newTitleKeyword.value.trim() || undefined,
    category: newIsPrivacy.value ? 'private' : newCategory.value,
    isPrivacy: newIsPrivacy.value,
    priority: newIsPrivacy.value ? 1050 : 900
  })
  newName.value = ''
  newAppPattern.value = ''
  newTitleKeyword.value = ''
  newIsPrivacy.value = false
  emit('updated')
}

async function deleteRule(id: string): Promise<void> {
  if (!window.api?.timeCoach) return
  rules.value = await window.api.timeCoach.deleteRule(id)
  emit('updated')
}

async function clearAllHistory(): Promise<void> {
  if (!window.api?.timeCoach) return
  await window.api.timeCoach.clearHistory()
  confirmClear.value = false
  feedback.value = '已清空所有本地时间账单记录'
  emit('updated')
}

onMounted(() => {
  void loadData()
})
</script>

<template>
  <div class="space-y-4">
    <!-- 隐私与采集参数 -->
    <div
      v-if="settings"
      class="rounded-xl border p-4 space-y-3"
      style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
    >
      <h3 class="text-xs font-semibold" style="color: var(--color-text-primary)">采集与隐私设置</h3>

      <div class="grid gap-3 md:grid-cols-2 text-xs">
        <label class="flex items-center justify-between rounded-lg border px-3 py-2.5 cursor-pointer" style="border-color: var(--color-border-muted); background: var(--color-bg-base)">
          <div>
            <div style="color: var(--color-text-primary)">保存窗口标题（默认关闭）</div>
            <div class="text-[11px]" style="color: var(--color-text-tertiary)">关闭时标题仅在内存中用于分类匹配，不落盘</div>
          </div>
          <input
            type="checkbox"
            class="accent-indigo-500"
            :checked="settings.saveWindowTitle"
            @change="updateSetting({ saveWindowTitle: ($event.target as HTMLInputElement).checked })"
          />
        </label>

        <label class="flex items-center justify-between rounded-lg border px-3 py-2.5 cursor-pointer" style="border-color: var(--color-border-muted); background: var(--color-bg-base)">
          <div>
            <div style="color: var(--color-text-primary)">温和防过劳提醒</div>
            <div class="text-[11px]" style="color: var(--color-text-tertiary)">连续专注达到阈值时提醒起身活动</div>
          </div>
          <input
            type="checkbox"
            class="accent-indigo-500"
            :checked="settings.breakReminderEnabled"
            @change="updateSetting({ breakReminderEnabled: ($event.target as HTMLInputElement).checked })"
          />
        </label>

        <div class="flex items-center justify-between rounded-lg border px-3 py-2.5" style="border-color: var(--color-border-muted); background: var(--color-bg-base)">
          <div>
            <div style="color: var(--color-text-primary)">普通闲置判定阈值（秒）</div>
            <div class="text-[11px]" style="color: var(--color-text-tertiary)">默认 180 秒无键鼠操作自动记为离开</div>
          </div>
          <input
            type="number"
            min="30"
            max="1800"
            class="w-20 rounded border px-2 py-1 text-right outline-none"
            style="background: var(--color-bg-elevated); border-color: var(--color-border-default); color: var(--color-text-primary)"
            :value="settings.idleThresholdSec"
            @change="updateSetting({ idleThresholdSec: Number(($event.target as HTMLInputElement).value) })"
          />
        </div>

        <div class="flex items-center justify-between rounded-lg border px-3 py-2.5" style="border-color: var(--color-border-muted); background: var(--color-bg-base)">
          <div>
            <div style="color: var(--color-text-primary)">防过劳提醒阈值（分钟）</div>
            <div class="text-[11px]" style="color: var(--color-text-tertiary)">连续专注超过该时长后在界面提示</div>
          </div>
          <input
            type="number"
            min="15"
            max="240"
            class="w-20 rounded border px-2 py-1 text-right outline-none"
            style="background: var(--color-bg-elevated); border-color: var(--color-border-default); color: var(--color-text-primary)"
            :value="settings.breakReminderMinutes"
            @change="updateSetting({ breakReminderMinutes: Number(($event.target as HTMLInputElement).value) })"
          />
        </div>
      </div>

      <div class="flex items-center justify-between pt-1">
        <span class="text-[11px]" style="color: var(--color-text-tertiary)">
          所有活动记录均保存在本地 userData/time-coach 目录，默认保留 {{ settings.retentionDays }} 天。
        </span>
        <div class="flex items-center gap-2">
          <button
            v-if="!confirmClear"
            type="button"
            class="rounded-md border border-rose-500/30 px-2.5 py-1 text-xs text-rose-400 hover:bg-rose-500/10"
            @click="confirmClear = true"
          >
            清空历史数据
          </button>
          <template v-else>
            <button
              type="button"
              class="rounded-md bg-rose-600 px-2.5 py-1 text-xs text-white"
              @click="clearAllHistory"
            >
              确认永久删除
            </button>
            <button
              type="button"
              class="rounded-md border px-2.5 py-1 text-xs"
              style="border-color: var(--color-border-default); color: var(--color-text-secondary)"
              @click="confirmClear = false"
            >
              取消
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- 新增自定义规则 -->
    <div
      class="rounded-xl border p-4 space-y-3"
      style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
    >
      <h3 class="text-xs font-semibold" style="color: var(--color-text-primary)">新增自定义分类规则 / 隐私黑名单</h3>

      <div class="grid gap-2.5 md:grid-cols-4 text-xs">
        <input
          v-model="newName"
          placeholder="规则名称（如 公司内部系统）"
          class="rounded-lg border px-2.5 py-1.5 outline-none focus:border-indigo-500"
          style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
        />
        <input
          v-model="newAppPattern"
          placeholder="进程名匹配（支持正则，如 Code）"
          class="rounded-lg border px-2.5 py-1.5 outline-none focus:border-indigo-500"
          style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
        />
        <input
          v-model="newTitleKeyword"
          placeholder="窗口标题关键词（可选）"
          class="rounded-lg border px-2.5 py-1.5 outline-none focus:border-indigo-500"
          style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
        />
        <select
          v-model="newCategory"
          :disabled="newIsPrivacy"
          class="rounded-lg border px-2.5 py-1.5 outline-none disabled:opacity-50"
          style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
        >
          <option v-for="c in CATEGORY_LIST" :key="c.id" :value="c.id">{{ c.label }}</option>
        </select>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <label class="flex items-center gap-2 text-xs cursor-pointer" style="color: var(--color-text-secondary)">
          <input v-model="newIsPrivacy" type="checkbox" class="accent-pink-500" />
          设为隐私黑名单（命中后不记录应用名与标题，直接跳过）
        </label>
        <button
          type="button"
          class="rounded-lg px-3.5 py-1.5 text-xs font-medium text-white"
          style="background: var(--color-accent)"
          @click="addRule"
        >
          添加规则
        </button>
      </div>

      <div v-if="feedback" class="text-xs text-amber-400">{{ feedback }}</div>
    </div>

    <!-- 规则列表 -->
    <div
      class="overflow-hidden rounded-xl border"
      style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
    >
      <div class="border-b px-4 py-2.5 text-xs font-semibold" style="border-color: var(--color-border-muted); color: var(--color-text-primary)">
        生效中的分类规则（{{ rules.length }} 条）
      </div>
      <div class="divide-y" style="border-color: var(--color-border-muted)">
        <div
          v-for="r in rules"
          :key="r.id"
          class="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
        >
          <div class="min-w-0 space-y-0.5">
            <div class="flex items-center gap-2">
              <span class="font-medium" style="color: var(--color-text-primary)">{{ r.name }}</span>
              <span
                class="rounded px-1.5 py-0.5 text-[10px]"
                :style="{ background: CATEGORY_META[r.category].badgeBg, color: CATEGORY_META[r.category].color }"
              >
                {{ CATEGORY_META[r.category].label }}
              </span>
              <span
                class="rounded px-1.5 py-0.5 text-[10px]"
                style="background: var(--color-bg-base); color: var(--color-text-tertiary)"
              >
                {{ r.source === 'user' ? '自定义' : '内置' }}
              </span>
            </div>
            <div class="truncate text-[11px] font-mono" style="color: var(--color-text-tertiary)">
              <span v-if="r.appPattern">进程: {{ r.appPattern }}</span>
              <span v-if="r.appPattern && r.titleKeyword"> · </span>
              <span v-if="r.titleKeyword">标题: {{ r.titleKeyword }}</span>
            </div>
          </div>

          <button
            v-if="r.source === 'user'"
            type="button"
            class="shrink-0 text-xs text-rose-400 hover:underline"
            @click="deleteRule(r.id)"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
