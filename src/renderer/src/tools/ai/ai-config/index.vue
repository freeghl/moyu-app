<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  AI_PROVIDER_PRESETS,
  type AiProfile,
  type AiProfileInput,
  type AiProviderPreset,
  type AiProviderType,
  type AiTestResult
} from '@shared/ai'
import { useAiStore } from '../../../stores/aiStore'
import { useAi } from '../../../utils/useAi'

const aiStore = useAiStore()
const { askStream, stop, loading: chatLoading } = useAi()

const query = ref('')
const selectedId = ref<string | 'new'>('new')
const showApiKey = ref(false)
const saving = ref(false)
const testing = ref(false)
const saveNotice = ref('')
const saveError = ref('')
const testResult = ref<AiTestResult | null>(null)

const quickPrompt = ref('')
const quickReply = ref('')
const quickError = ref('')

const form = reactive<{
  id?: string
  name: string
  provider: AiProviderType
  baseUrl: string
  model: string
  apiKey: string
  clearApiKey: boolean
  temperature: number
  maxTokens: number
  enabled: boolean
}>({
  name: 'DeepSeek',
  provider: 'openai-compatible',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  apiKey: '',
  clearApiKey: false,
  temperature: 0.7,
  maxTokens: 2048,
  enabled: true
})

const selectedProfile = computed<AiProfile | null>(() => {
  if (selectedId.value === 'new') return null
  return aiStore.profiles.find((item) => item.id === selectedId.value) ?? null
})

const filteredProfiles = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return aiStore.profiles
  return aiStore.profiles.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.model.toLowerCase().includes(q) ||
      item.provider.toLowerCase().includes(q)
  )
})

const isDefaultSelected = computed(
  () => Boolean(selectedProfile.value && selectedProfile.value.id === aiStore.defaultProfileId)
)

function loadPreset(preset: AiProviderPreset): void {
  form.name = preset.name
  form.provider = preset.provider
  form.baseUrl = preset.baseUrl
  form.model = preset.defaultModel
  testResult.value = null
  saveError.value = ''
}

function startCreate(): void {
  selectedId.value = 'new'
  form.id = undefined
  form.apiKey = ''
  form.clearApiKey = false
  form.temperature = 0.7
  form.maxTokens = 2048
  form.enabled = true
  loadPreset(AI_PROVIDER_PRESETS[1])
}

function selectProfile(profile: AiProfile): void {
  selectedId.value = profile.id
  form.id = profile.id
  form.name = profile.name
  form.provider = profile.provider
  form.baseUrl = profile.baseUrl
  form.model = profile.model
  form.apiKey = ''
  form.clearApiKey = false
  form.temperature = profile.temperature
  form.maxTokens = profile.maxTokens
  form.enabled = profile.enabled
  showApiKey.value = false
  testResult.value = null
  saveError.value = ''
  saveNotice.value = ''
}

function buildPayload(): AiProfileInput {
  return {
    id: form.id,
    name: form.name.trim(),
    provider: form.provider,
    baseUrl: form.baseUrl.trim(),
    model: form.model.trim(),
    apiKey: form.apiKey.trim() || undefined,
    clearApiKey: form.clearApiKey,
    temperature: Number(form.temperature),
    maxTokens: Number(form.maxTokens),
    enabled: form.enabled
  }
}

async function handleSave(): Promise<void> {
  saveError.value = ''
  saveNotice.value = ''

  if (!form.name.trim()) {
    saveError.value = '请填写配置名称'
    return
  }
  if (!form.baseUrl.trim()) {
    saveError.value = '请填写 Base URL'
    return
  }
  if (!form.model.trim()) {
    saveError.value = '请填写模型名称'
    return
  }

  saving.value = true
  try {
    const previousIds = new Set(aiStore.profiles.map((p) => p.id))
    const next = await aiStore.saveProfile(buildPayload())
    if (form.id) {
      const updated = next.profiles.find((p) => p.id === form.id)
      if (updated) selectProfile(updated)
    } else {
      const created = next.profiles.find((p) => !previousIds.has(p.id)) ?? next.profiles[0]
      if (created) selectProfile(created)
    }
    saveNotice.value = '配置已加密保存'
    setTimeout(() => {
      if (saveNotice.value === '配置已加密保存') saveNotice.value = ''
    }, 2200)
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : String(err)
  } finally {
    saving.value = false
  }
}

async function handleTest(): Promise<void> {
  testResult.value = null
  testing.value = true
  try {
    testResult.value = await aiStore.testConnection(buildPayload())
  } finally {
    testing.value = false
  }
}

async function handleSetDefault(): Promise<void> {
  if (!selectedProfile.value) return
  await aiStore.setDefault(selectedProfile.value.id)
}

async function handleDelete(): Promise<void> {
  if (!selectedProfile.value) return
  const next = await aiStore.deleteProfile(selectedProfile.value.id)
  if (next.profiles.length > 0) {
    selectProfile(next.profiles[0])
  } else {
    startCreate()
  }
}

async function handleQuickChat(): Promise<void> {
  const prompt = quickPrompt.value.trim()
  if (!prompt || !selectedProfile.value) return
  quickReply.value = ''
  quickError.value = ''
  try {
    await askStream(
      [{ role: 'user', content: prompt }],
      (delta) => {
        quickReply.value += delta
      },
      { profileId: selectedProfile.value.id }
    )
  } catch (err) {
    quickError.value = err instanceof Error ? err.message : String(err)
  }
}

watch(
  () => aiStore.ready,
  (isReady) => {
    if (!isReady) return
    if (aiStore.profiles.length > 0 && selectedId.value === 'new' && !form.id) {
      const preferred = aiStore.defaultProfile ?? aiStore.profiles[0]
      selectProfile(preferred)
    }
  },
  { immediate: true }
)

onMounted(async () => {
  await aiStore.init()
  if (aiStore.profiles.length > 0) {
    selectProfile(aiStore.defaultProfile ?? aiStore.profiles[0])
  } else {
    startCreate()
  }
})
</script>

<template>
  <section class="flex h-full min-h-0">
    <!-- 左侧配置列表 -->
    <aside
      class="flex w-64 shrink-0 flex-col border-r"
      style="border-color: var(--color-border-muted); background: var(--color-bg-elevated)"
    >
      <div class="space-y-2 border-b p-2.5" style="border-color: var(--color-border-muted)">
        <input
          v-model="query"
          class="w-full rounded-md border px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500"
          style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
          placeholder="搜索模型配置…"
          aria-label="搜索模型配置"
        />
        <button
          type="button"
          class="w-full cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
          style="background: var(--color-accent)"
          @click="startCreate"
        >
          + 新建模型配置
        </button>
      </div>

      <ul class="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        <li v-for="item in filteredProfiles" :key="item.id">
          <button
            type="button"
            class="w-full cursor-pointer rounded-md border px-2.5 py-2 text-left transition-colors hover:bg-white/[0.04]"
            :style="{
              background: item.id === selectedId ? 'var(--color-accent-muted)' : 'transparent',
              borderColor: item.id === selectedId ? 'rgba(99, 102, 241, 0.35)' : 'transparent'
            }"
            @click="selectProfile(item)"
          >
            <div class="flex items-center justify-between gap-1.5">
              <span class="flex min-w-0 items-center gap-1.5 text-xs font-medium" style="color: var(--color-text-primary)">
                <span
                  class="h-1.5 w-1.5 shrink-0 rounded-full"
                  :style="{ background: item.enabled ? 'var(--color-success)' : 'var(--color-text-disabled)' }"
                />
                <span class="truncate">{{ item.name }}</span>
              </span>
              <span
                v-if="item.id === aiStore.defaultProfileId"
                class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                style="background: var(--color-accent-subtle); color: var(--color-accent-hover)"
              >
                默认
              </span>
            </div>
            <div class="mt-1 truncate font-mono text-[11px]" style="color: var(--color-text-tertiary)">
              {{ item.model || '未指定模型' }}
            </div>
          </button>
        </li>
        <li v-if="!filteredProfiles.length" class="px-2 py-8 text-center text-xs" style="color: var(--color-text-tertiary)">
          {{ aiStore.profiles.length ? '没有匹配的配置' : '暂无模型配置，点击上方新建' }}
        </li>
      </ul>

      <div class="border-t px-3 py-2.5 text-[11px]" style="border-color: var(--color-border-muted); color: var(--color-text-tertiary)">
        API Key 由系统安全存储加密保存，所有工具通过统一接口调用。
      </div>
    </aside>

    <!-- 右侧可视化配置面板 -->
    <div class="min-w-0 flex-1 overflow-y-auto px-6 py-5" style="background: var(--color-bg-base)">
      <div class="mx-auto max-w-3xl space-y-5">
        <!-- 顶部标题栏 -->
        <header class="flex flex-wrap items-center justify-between gap-3 border-b pb-4" style="border-color: var(--color-border-muted)">
          <div>
            <h1 class="text-base font-semibold" style="color: var(--color-text-primary)">
              {{ selectedProfile ? `编辑配置 · ${selectedProfile.name}` : '新建 AI 模型配置' }}
            </h1>
            <p class="mt-0.5 text-xs" style="color: var(--color-text-tertiary)">
              配置完成后，所有内置工具与扩展插件均可直接复用此处已启用的模型。
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="selectedProfile && !isDefaultSelected"
              type="button"
              class="cursor-pointer rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:bg-white/[0.04]"
              style="border-color: var(--color-border-default); color: var(--color-text-secondary)"
              @click="handleSetDefault"
            >
              设为默认
            </button>
            <span
              v-else-if="isDefaultSelected"
              class="rounded-md border px-2.5 py-1.5 text-xs font-medium"
              style="border-color: rgba(16, 185, 129, 0.35); background: rgba(16, 185, 129, 0.1); color: var(--color-success)"
            >
              ✓ 当前默认模型
            </span>
            <button
              v-if="selectedProfile"
              type="button"
              class="cursor-pointer rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:bg-white/[0.04]"
              style="border-color: var(--color-border-default); color: var(--color-error)"
              @click="handleDelete"
            >
              删除
            </button>
          </div>
        </header>

        <!-- 快速预设模板 -->
        <div class="space-y-2">
          <div class="text-xs font-medium" style="color: var(--color-text-secondary)">快速填入预设</div>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button
              v-for="preset in AI_PROVIDER_PRESETS"
              :key="preset.id"
              type="button"
              class="cursor-pointer rounded-lg border p-2.5 text-left transition-colors hover:bg-white/[0.03]"
              style="border-color: var(--color-border-default); background: var(--color-bg-elevated)"
              @click="loadPreset(preset)"
            >
              <div class="text-xs font-medium" style="color: var(--color-text-primary)">{{ preset.name }}</div>
              <div class="mt-0.5 line-clamp-1 text-[11px]" style="color: var(--color-text-tertiary)">
                {{ preset.description }}
              </div>
            </button>
          </div>
        </div>

        <!-- 主配置表单 -->
        <div
          class="space-y-4 rounded-xl border p-4"
          style="border-color: var(--color-border-default); background: var(--color-bg-elevated)"
        >
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label class="block space-y-1.5">
              <span class="text-xs font-medium" style="color: var(--color-text-secondary)">配置名称</span>
              <input
                v-model="form.name"
                type="text"
                class="w-full rounded-md border px-3 py-2 text-xs outline-none focus:border-indigo-500"
                style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
                placeholder="例如：DeepSeek 对话"
              />
            </label>

            <label class="block space-y-1.5">
              <span class="text-xs font-medium" style="color: var(--color-text-secondary)">接口协议</span>
              <select
                v-model="form.provider"
                class="w-full rounded-md border px-3 py-2 text-xs outline-none focus:border-indigo-500"
                style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
              >
                <option value="openai-compatible">OpenAI 兼容格式</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="ollama">Ollama 本地模型</option>
              </select>
            </label>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label class="block space-y-1.5">
              <span class="text-xs font-medium" style="color: var(--color-text-secondary)">Base URL</span>
              <input
                v-model="form.baseUrl"
                type="text"
                class="w-full rounded-md border px-3 py-2 font-mono text-xs outline-none focus:border-indigo-500"
                style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
                placeholder="https://api.openai.com/v1"
              />
            </label>

            <label class="block space-y-1.5">
              <span class="text-xs font-medium" style="color: var(--color-text-secondary)">模型名称 (Model)</span>
              <input
                v-model="form.model"
                type="text"
                class="w-full rounded-md border px-3 py-2 font-mono text-xs outline-none focus:border-indigo-500"
                style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
                placeholder="gpt-4o-mini / deepseek-chat"
              />
            </label>
          </div>

          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium" style="color: var(--color-text-secondary)">
                API Key
                <span v-if="form.provider === 'ollama'" class="ml-1 font-normal" style="color: var(--color-text-tertiary)">
                  (Ollama 本地通常无需填写)
                </span>
              </span>
              <span
                v-if="selectedProfile?.hasApiKey && !form.clearApiKey"
                class="font-mono text-[11px]"
                style="color: var(--color-text-tertiary)"
              >
                已保存: {{ selectedProfile.maskedApiKey }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <input
                v-model="form.apiKey"
                :type="showApiKey ? 'text' : 'password'"
                class="min-w-0 flex-1 rounded-md border px-3 py-2 font-mono text-xs outline-none focus:border-indigo-500"
                style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
                :placeholder="selectedProfile?.hasApiKey ? '留空表示保持原 API Key 不变' : 'sk-...'"
                @input="form.clearApiKey = false"
              />
              <button
                type="button"
                class="cursor-pointer rounded-md border px-2.5 py-2 text-xs hover:bg-white/[0.04]"
                style="border-color: var(--color-border-default); color: var(--color-text-secondary)"
                @click="showApiKey = !showApiKey"
              >
                {{ showApiKey ? '隐藏' : '显示' }}
              </button>
              <button
                v-if="selectedProfile?.hasApiKey"
                type="button"
                class="cursor-pointer rounded-md border px-2.5 py-2 text-xs hover:bg-white/[0.04]"
                style="border-color: var(--color-border-default); color: var(--color-text-tertiary)"
                @click="form.apiKey = ''; form.clearApiKey = true"
              >
                清空
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label class="block space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-medium" style="color: var(--color-text-secondary)">Temperature</span>
                <span class="font-mono" style="color: var(--color-text-tertiary)">{{ form.temperature }}</span>
              </div>
              <input v-model.number="form.temperature" type="range" min="0" max="2" step="0.1" class="w-full accent-indigo-500" />
            </label>

            <label class="block space-y-1.5">
              <span class="text-xs font-medium" style="color: var(--color-text-secondary)">Max Tokens</span>
              <input
                v-model.number="form.maxTokens"
                type="number"
                min="64"
                max="128000"
                step="128"
                class="w-full rounded-md border px-3 py-1.5 font-mono text-xs outline-none focus:border-indigo-500"
                style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
              />
            </label>

            <div class="flex items-end pb-1">
              <label class="flex cursor-pointer items-center gap-2 text-xs" style="color: var(--color-text-secondary)">
                <input v-model="form.enabled" type="checkbox" class="h-3.5 w-3.5 accent-indigo-500" />
                <span>启用此配置（供插件选用）</span>
              </label>
            </div>
          </div>

          <!-- 底部操作与反馈 -->
          <div class="flex flex-wrap items-center justify-between gap-3 border-t pt-3" style="border-color: var(--color-border-muted)">
            <div class="min-h-[20px] text-xs">
              <span v-if="saveError" style="color: var(--color-error)">{{ saveError }}</span>
              <span v-else-if="saveNotice" style="color: var(--color-success)">✓ {{ saveNotice }}</span>
              <span v-else-if="testResult" :style="{ color: testResult.ok ? 'var(--color-success)' : 'var(--color-error)' }">
                {{ testResult.ok ? `✓ ${testResult.message} (${testResult.latencyMs}ms)` : `✕ ${testResult.message}` }}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                :disabled="testing"
                class="cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/[0.04] disabled:opacity-50"
                style="border-color: var(--color-border-default); color: var(--color-text-primary)"
                @click="handleTest"
              >
                {{ testing ? '测试中…' : '测试连接' }}
              </button>
              <button
                type="button"
                :disabled="saving"
                class="cursor-pointer rounded-md px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style="background: var(--color-accent)"
                @click="handleSave"
              >
                {{ saving ? '保存中…' : '保存配置' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 在线试聊验证 -->
        <div
          v-if="selectedProfile"
          class="space-y-3 rounded-xl border p-4"
          style="border-color: var(--color-border-default); background: var(--color-bg-elevated)"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium" style="color: var(--color-text-primary)">快速对话验证</span>
            <span class="text-[11px]" style="color: var(--color-text-tertiary)">直接测试当前选中的配置流式输出</span>
          </div>
          <div class="flex gap-2">
            <input
              v-model="quickPrompt"
              type="text"
              class="min-w-0 flex-1 rounded-md border px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
              style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
              placeholder="输入一句测试消息，按回车发送…"
              @keydown.enter="handleQuickChat"
            />
            <button
              v-if="!chatLoading"
              type="button"
              class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              style="background: var(--color-accent)"
              @click="handleQuickChat"
            >
              发送
            </button>
            <button
              v-else
              type="button"
              class="cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium"
              style="border-color: var(--color-border-default); color: var(--color-error)"
              @click="stop"
            >
              停止
            </button>
          </div>
          <div
            v-if="quickReply || quickError"
            class="rounded-md border p-3 font-mono text-xs leading-5 whitespace-pre-wrap"
            style="background: var(--color-bg-base); border-color: var(--color-border-muted)"
            :style="{ color: quickError ? 'var(--color-error)' : 'var(--color-text-secondary)' }"
          >
            {{ quickError || quickReply }}
          </div>
        </div>

        <!-- 开发者复用指南 -->
        <div
          class="space-y-2 rounded-xl border p-4"
          style="border-color: var(--color-border-muted); background: var(--color-bg-surface)"
        >
          <div class="text-xs font-medium" style="color: var(--color-text-secondary)">插件 / 工具接入方式</div>
          <pre
            class="overflow-x-auto rounded-md border p-3 font-mono text-[11px] leading-5"
            style="background: var(--color-bg-base); border-color: var(--color-border-muted); color: var(--color-text-secondary)"
          >import { useAi } from '../../../utils/useAi'

const { askStream, profiles, isConfigured } = useAi()
await askStream([{ role: 'user', content: '你好' }], (delta) => {
  output.value += delta
})</pre>
        </div>
      </div>
    </div>
  </section>
</template>
