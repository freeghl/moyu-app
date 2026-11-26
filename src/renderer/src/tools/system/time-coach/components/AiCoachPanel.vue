<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { TimeCoachDailyNote } from '@shared/timeCoach'
import { useAi } from '../../../../utils/useAi'

const props = defineProps<{
  date: string
}>()

const { profiles, defaultProfile, isConfigured, loading: aiLoading, error: aiError, askStream, stop, openConfig } = useAi()

const selectedProfileId = ref<string>('')
const note = ref<TimeCoachDailyNote>({ date: props.date, updatedAt: 0 })
const digestPreview = ref('')
const showDigest = ref(false)
const activeMode = ref<'review' | 'report' | 'weekly'>('review')
const outputText = ref('')
const copied = ref(false)
const savingNote = ref(false)

const effectiveProfileId = computed(
  () => selectedProfileId.value || defaultProfile.value?.id || ''
)

async function loadNoteAndDigest(): Promise<void> {
  if (!window.api?.timeCoach) return
  note.value = await window.api.timeCoach.getDailyNote(props.date)
  if (activeMode.value === 'report' && note.value.aiReport) {
    outputText.value = note.value.aiReport
  } else if (note.value.aiReview) {
    outputText.value = note.value.aiReview
  } else {
    outputText.value = ''
  }
  if (showDigest.value) {
    digestPreview.value = await window.api.timeCoach.buildAiDigest(
      props.date,
      activeMode.value === 'weekly' ? 7 : 1
    )
  }
}

async function saveNoteFields(): Promise<void> {
  if (!window.api?.timeCoach) return
  savingNote.value = true
  try {
    note.value = await window.api.timeCoach.saveDailyNote({
      date: props.date,
      energyScore: note.value.energyScore,
      goal: note.value.goal,
      note: note.value.note
    })
  } finally {
    savingNote.value = false
  }
}

async function toggleDigestPreview(): Promise<void> {
  showDigest.value = !showDigest.value
  if (showDigest.value && window.api?.timeCoach) {
    digestPreview.value = await window.api.timeCoach.buildAiDigest(
      props.date,
      activeMode.value === 'weekly' ? 7 : 1
    )
  }
}

function buildPrompts(mode: 'review' | 'report' | 'weekly', digest: string): Array<{ role: 'system' | 'user'; content: string }> {
  if (mode === 'report') {
    return [
      {
        role: 'system',
        content:
          '你是一位严谨高效的技术工作助手。请根据用户提供的脱敏时间账单统计和用户主动填写的目标/备注，生成一份结构清晰、可直接发送的工作日报草稿（Markdown 格式）。严禁根据软件时长编造未提及的具体业务产出；如果用户未填写具体产出，请在对应位置留出简短占位提示。'
      },
      {
        role: 'user',
        content: `请基于以下数据生成 ${props.date} 的工作日报草稿：\n\n${digest}`
      }
    ]
  }

  if (mode === 'weekly') {
    return [
      {
        role: 'system',
        content:
          '你是一位理性、温和、懂开发者工作节奏的 AI 精力教练。请根据近 7 天的脱敏时间统计，给出：1) 本周专注与节奏画像；2) 高切换或过劳风险信号；3) 下周可执行的 2-3 条节奏优化建议；4) 简短周报总结。语言简洁，重点突出。'
      },
      {
        role: 'user',
        content: `请分析以下近 7 天时间账单摘要：\n\n${digest}`
      }
    ]
  }

  return [
    {
      role: 'system',
      content:
        '你是一位理性、温和、懂开发者工作节奏的 AI 精力教练。请基于今日脱敏后的时间账单摘要与用户精力自评，给出：1) 今日工作与专注节奏点评；2) 注意力切换/碎片化分析；3) 明日可落地的节奏与防过劳建议。控制篇幅在 300-500 字，避免空话。'
    },
    {
      role: 'user',
      content: `请帮我复盘 ${props.date} 的时间与精力表现：\n\n${digest}`
    }
  ]
}

async function generate(mode: 'review' | 'report' | 'weekly'): Promise<void> {
  if (!window.api?.timeCoach) return
  activeMode.value = mode
  await saveNoteFields()

  const digest = await window.api.timeCoach.buildAiDigest(props.date, mode === 'weekly' ? 7 : 1)
  digestPreview.value = digest
  outputText.value = ''

  try {
    await askStream(
      buildPrompts(mode, digest),
      (delta) => {
        outputText.value += delta
      },
      { profileId: effectiveProfileId.value || undefined }
    )

    if (outputText.value.trim()) {
      note.value = await window.api.timeCoach.saveDailyNote({
        date: props.date,
        ...(mode === 'report' ? { aiReport: outputText.value } : { aiReview: outputText.value })
      })
    }
  } catch {
    // error is captured in aiError
  }
}

async function copyOutput(): Promise<void> {
  if (!outputText.value) return
  await navigator.clipboard.writeText(outputText.value)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 1500)
}

watch(
  () => props.date,
  () => {
    void loadNoteAndDigest()
  }
)

onMounted(() => {
  void loadNoteAndDigest()
})
</script>

<template>
  <div class="space-y-4">
    <!-- AI 模型状态条 -->
    <div
      class="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5"
      style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
    >
      <div class="flex items-center gap-2.5 text-xs">
        <span
          class="inline-block h-2 w-2 rounded-full"
          :style="{ background: isConfigured ? 'var(--color-success)' : 'var(--color-warning)' }"
        />
        <span style="color: var(--color-text-primary)">
          {{ isConfigured ? '已对接全局 AI 配置中心' : '尚未配置 AI 模型' }}
        </span>
        <select
          v-if="profiles.length > 0"
          v-model="selectedProfileId"
          class="rounded-md border px-2 py-1 text-xs outline-none"
          style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
        >
          <option value="">默认 ({{ defaultProfile?.name }} · {{ defaultProfile?.model }})</option>
          <option v-for="p in profiles" :key="p.id" :value="p.id">
            {{ p.name }} ({{ p.model }})
          </option>
        </select>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-md border px-2.5 py-1 text-xs transition hover:opacity-85"
          style="border-color: var(--color-border-default); color: var(--color-text-secondary)"
          @click="toggleDigestPreview"
        >
          {{ showDigest ? '隐藏脱敏摘要' : '预览发送摘要' }}
        </button>
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium text-white transition hover:opacity-90"
          style="background: var(--color-accent)"
          @click="openConfig"
        >
          {{ isConfigured ? '管理 AI 模型' : '前往 AI 模型配置' }}
        </button>
      </div>
    </div>

    <!-- 脱敏摘要预览 -->
    <div
      v-if="showDigest"
      class="rounded-xl border p-3.5 space-y-2"
      style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
    >
      <div class="flex items-center justify-between text-[11px]" style="color: var(--color-text-tertiary)">
        <span>以下为将发送给 AI 的脱敏聚合数据（不含任何窗口标题或隐私应用）：</span>
      </div>
      <pre
        class="max-h-52 overflow-auto rounded-lg border p-3 text-[11px] leading-relaxed whitespace-pre-wrap font-mono"
        style="background: var(--color-bg-base); border-color: var(--color-border-muted); color: var(--color-text-secondary)"
      >{{ digestPreview || '暂无统计数据' }}</pre>
    </div>

    <!-- 精力自评与目标输入 -->
    <div
      class="rounded-xl border p-4 space-y-3"
      style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-xs font-semibold" style="color: var(--color-text-primary)">
          今日精力自评与工作记录（仅本地保存，辅助 AI 生成更准确的复盘与日报）
        </h3>
        <span v-if="savingNote" class="text-[11px]" style="color: var(--color-text-tertiary)">保存中...</span>
      </div>

      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span style="color: var(--color-text-secondary)">今日精力评分：</span>
        <button
          v-for="score in [1, 2, 3, 4, 5]"
          :key="score"
          type="button"
          class="h-7 w-7 rounded-md border text-xs font-medium transition"
          :style="
            note.energyScore === score
              ? 'background: var(--color-accent); border-color: var(--color-accent); color: #fff'
              : 'background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-secondary)'
          "
          @click="note.energyScore = score; saveNoteFields()"
        >
          {{ score }}
        </button>
        <span class="text-[11px] ml-1" style="color: var(--color-text-tertiary)">1 疲惫 · 5 充沛</span>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <div class="space-y-1">
          <label class="text-[11px]" style="color: var(--color-text-tertiary)">今日目标 / 完成事项</label>
          <textarea
            v-model="note.goal"
            rows="3"
            placeholder="例如：完成时间账单核心采集模块；修复登录态刷新问题..."
            class="w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-indigo-500"
            style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
            @blur="saveNoteFields"
          />
        </div>
        <div class="space-y-1">
          <label class="text-[11px]" style="color: var(--color-text-tertiary)">主观感受 / 明日计划备注</label>
          <textarea
            v-model="note.note"
            rows="3"
            placeholder="例如：下午会议较多被打断，明天上午留 2 小时整块编码..."
            class="w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-indigo-500"
            style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
            @blur="saveNoteFields"
          />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          :disabled="aiLoading || !isConfigured"
          class="rounded-lg px-3.5 py-1.5 text-xs font-medium text-white transition disabled:opacity-50"
          style="background: var(--color-accent)"
          @click="generate('review')"
        >
          生成今日精力复盘
        </button>
        <button
          type="button"
          :disabled="aiLoading || !isConfigured"
          class="rounded-lg border px-3.5 py-1.5 text-xs font-medium transition disabled:opacity-50"
          style="border-color: var(--color-border-default); color: var(--color-text-primary); background: var(--color-bg-base)"
          @click="generate('report')"
        >
          一键生成工作日报
        </button>
        <button
          type="button"
          :disabled="aiLoading || !isConfigured"
          class="rounded-lg border px-3.5 py-1.5 text-xs font-medium transition disabled:opacity-50"
          style="border-color: var(--color-border-default); color: var(--color-text-primary); background: var(--color-bg-base)"
          @click="generate('weekly')"
        >
          生成近 7 天周报建议
        </button>
        <button
          v-if="aiLoading"
          type="button"
          class="rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs text-rose-400"
          @click="stop"
        >
          停止生成
        </button>
      </div>
    </div>

    <!-- AI 输出结果 -->
    <div
      class="rounded-xl border p-4 space-y-2.5"
      style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
    >
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold" style="color: var(--color-text-primary)">
          {{ activeMode === 'report' ? '工作日报草稿' : activeMode === 'weekly' ? '近 7 天周报与建议' : 'AI 精力复盘' }}
        </span>
        <button
          v-if="outputText"
          type="button"
          class="rounded-md border px-2.5 py-1 text-[11px] transition hover:opacity-85"
          style="border-color: var(--color-border-default); color: var(--color-text-secondary)"
          @click="copyOutput"
        >
          {{ copied ? '已复制' : '复制 Markdown' }}
        </button>
      </div>

      <div v-if="aiError" class="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
        {{ aiError }}
      </div>

      <div
        v-if="!outputText && !aiLoading"
        class="py-10 text-center text-xs"
        style="color: var(--color-text-tertiary)"
      >
        {{ isConfigured ? '点击上方按钮，AI 将基于脱敏统计为你生成复盘或日报' : '请先在「AI 模型配置」中添加可用模型' }}
      </div>

      <pre
        v-else
        class="whitespace-pre-wrap text-xs leading-relaxed font-sans"
        style="color: var(--color-text-primary)"
      >{{ outputText }}<span v-if="aiLoading" class="animate-pulse">▋</span></pre>
    </div>
  </div>
</template>
