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
const showAdvancedAuth = ref(false)
const saving = ref(false)
const testing = ref(false)
const fetchingModels = ref(false)
const fetchedModels = ref<string[]>([])
const modelFetchMsg = ref('')
const modelFetchOk = ref(true)
const saveNotice = ref('')
const saveError = ref('')
const testResult = ref<AiTestResult | null>(null)

const quickPrompt = ref('')
const quickReply = ref('')
const quickError = ref('')
const quickStatus = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
const quickLatencyMs = ref(0)

const form = reactive<{
  id?: string
  name: string
  provider: AiProviderType
  baseUrl: string
  model: string
  apiKey: string
  clearApiKey: boolean
  authHeaderName: string
  authHeaderPrefix: string
  customHeaderRows: Array<{ key: string; value: string }>
  temperature: number
  enabled: boolean
}>({
  name: 'DeepSeek',
  provider: 'openai-compatible',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  apiKey: '',
  clearApiKey: false,
  authHeaderName: '',
  authHeaderPrefix: 'Bearer',
  customHeaderRows: [],
  temperature: 0.7,
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
  form.authHeaderName = ''
  form.authHeaderPrefix = preset.provider === 'anthropic' ? '' : 'Bearer'
  form.customHeaderRows = []
  showAdvancedAuth.value = preset.id === 'custom'
  fetchedModels.value = []
  modelFetchMsg.value = ''
  testResult.value = null
  saveError.value = ''
}

function startCreate(): void {
  selectedId.value = 'new'
  form.id = undefined
  form.apiKey = ''
  form.clearApiKey = false
  form.temperature = 0.7
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
  form.authHeaderName = profile.authHeaderName ?? ''
  form.authHeaderPrefix = profile.authHeaderPrefix ?? (profile.provider === 'anthropic' ? '' : 'Bearer')
  form.customHeaderRows = Object.entries(profile.customHeaders ?? {}).map(([key, value]) => ({ key, value }))
  showAdvancedAuth.value = Boolean(profile.authHeaderName || form.customHeaderRows.length > 0)
  form.temperature = profile.temperature
  form.enabled = profile.enabled
  showApiKey.value = false
  fetchedModels.value = []
  modelFetchMsg.value = ''
  testResult.value = null
  saveError.value = ''
  saveNotice.value = ''
}

function addCustomHeaderRow(): void {
  form.customHeaderRows.push({ key: '', value: '' })
}

function removeCustomHeaderRow(index: number): void {
  form.customHeaderRows.splice(index, 1)
}

function buildPayload(): AiProfileInput {
  const customHeaders: Record<string, string> = {}
  for (const row of form.customHeaderRows) {
    const k = row.key.trim()
    const v = row.value.trim()
    if (k && v) customHeaders[k] = v
  }

  return {
    id: form.id,
    name: form.name.trim(),
    provider: form.provider,
    baseUrl: form.baseUrl.trim(),
    model: form.model.trim(),
    apiKey: form.apiKey.trim() || undefined,
    clearApiKey: form.clearApiKey,
    authHeaderName: form.authHeaderName.trim() || undefined,
    authHeaderPrefix: form.authHeaderPrefix.trim(),
    customHeaders: Object.keys(customHeaders).length ? customHeaders : undefined,
    temperature: Number(form.temperature),
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

async function handleFetchModels(): Promise<void> {
  modelFetchOk.value = false
  modelFetchMsg.value = '正在请求模型列表…'
  fetchingModels.value = true
  try {
    const payload = buildPayload()
    if (!payload.baseUrl) {
      modelFetchMsg.value = '请先填写 Base URL 再获取模型'
      return
    }
    if (payload.provider !== 'ollama' && !payload.apiKey && !selectedProfile.value?.hasApiKey) {
      modelFetchMsg.value = '请先填写 API Key 再获取模型'
      return
    }

    const res = await aiStore.listModels(payload)
    if (res.ok && res.models.length > 0) {
      modelFetchOk.value = true
      modelFetchMsg.value = res.message || `已获取 ${res.models.length} 个模型`
      fetchedModels.value = res.models
      if (!form.model.trim() || !res.models.includes(form.model.trim())) {
        form.model = res.models[0]
      }
    } else if (res.ok) {
      modelFetchOk.value = false
      modelFetchMsg.value = res.message || '接口未返回任何模型，请手动填写模型名称'
    } else {
      modelFetchOk.value = false
      modelFetchMsg.value = res.message || '获取模型列表失败，请检查 Base URL 或 API Key'
    }
  } catch (err) {
    modelFetchOk.value = false
    modelFetchMsg.value = err instanceof Error ? err.message : `获取失败: ${String(err)}`
  } finally {
    fetchingModels.value = false
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
  if (!selectedProfile.value) return
  const prompt = quickPrompt.value.trim()
  if (!prompt) {
    quickStatus.value = 'error'
    quickError.value = '请先输入测试消息再发送'
    return
  }

  quickReply.value = ''
  quickError.value = ''
  quickStatus.value = 'loading'
  const started = Date.now()
  try {
    await askStream(
      [{ role: 'user', content: prompt }],
      (delta) => {
        quickReply.value += delta
      },
      { profileId: selectedProfile.value.id }
    )
    quickLatencyMs.value = Date.now() - started
    quickStatus.value = 'success'
  } catch (err) {
    quickLatencyMs.value = Date.now() - started
    quickStatus.value = 'error'
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

            <div class="space-y-1.5">
              <span class="block text-xs font-medium" style="color: var(--color-text-secondary)">模型名称 (Model)</span>
              <div class="flex items-center gap-2">
                <select
                  v-if="fetchedModels.length > 0"
                  v-model="form.model"
                  class="min-w-0 flex-1 rounded-md border px-3 py-2 font-mono text-xs outline-none focus:border-indigo-500"
                  style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
                >
                  <option v-if="form.model && !fetchedModels.includes(form.model)" :value="form.model">
                    {{ form.model }}
                  </option>
                  <option v-for="m in fetchedModels" :key="m" :value="m">{{ m }}</option>
                </select>
                <input
                  v-else
                  v-model="form.model"
                  type="text"
                  class="min-w-0 flex-1 rounded-md border px-3 py-2 font-mono text-xs outline-none focus:border-indigo-500"
                  style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
                  placeholder="gpt-4o-mini / deepseek-chat"
                />
                <button
                  type="button"
                  :disabled="fetchingModels"
                  class="shrink-0 cursor-pointer rounded-md border px-2.5 py-2 text-xs transition-colors hover:bg-white/[0.04] disabled:opacity-50"
                  style="border-color: var(--color-border-default); color: var(--color-text-secondary)"
                  @click="handleFetchModels"
                >
                  {{ fetchingModels ? '获取中…' : '获取模型' }}
                </button>
                <button
                  v-if="fetchedModels.length > 0"
                  type="button"
                  class="shrink-0 cursor-pointer rounded-md border px-2 py-2 text-xs transition-colors hover:bg-white/[0.04]"
                  style="border-color: var(--color-border-default); color: var(--color-text-tertiary)"
                  title="切换为手动输入"
                  @click="fetchedModels = []"
                >
                  手填
                </button>
              </div>
              <div
                v-if="modelFetchMsg"
                class="rounded-md border px-2.5 py-1.5 text-[11px]"
                :style="{
                  borderColor: fetchingModels
                    ? 'var(--color-border-default)'
                    : modelFetchOk
                      ? 'rgba(16, 185, 129, 0.35)'
                      : 'rgba(239, 68, 68, 0.35)',
                  background: fetchingModels
                    ? 'var(--color-bg-base)'
                    : modelFetchOk
                      ? 'rgba(16, 185, 129, 0.08)'
                      : 'rgba(239, 68, 68, 0.08)',
                  color: fetchingModels
                    ? 'var(--color-text-secondary)'
                    : modelFetchOk
                      ? 'var(--color-success)'
                      : 'var(--color-error)'
                }"
              >
                {{ fetchingModels ? '⏳ ' : modelFetchOk ? '✓ ' : '✕ ' }}{{ modelFetchMsg }}
              </div>
            </div>
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

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label class="block space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-medium" style="color: var(--color-text-secondary)">Temperature</span>
                <span class="font-mono" style="color: var(--color-text-tertiary)">{{ form.temperature }}</span>
              </div>
              <input v-model.number="form.temperature" type="range" min="0" max="2" step="0.1" class="w-full accent-indigo-500" />
            </label>

            <div class="flex items-end pb-1">
              <label class="flex cursor-pointer items-center gap-2 text-xs" style="color: var(--color-text-secondary)">
                <input v-model="form.enabled" type="checkbox" class="h-3.5 w-3.5 accent-indigo-500" />
                <span>启用此配置（供插件选用）</span>
              </label>
            </div>
          </div>

          <!-- 自定义认证字段与附加请求头 -->
          <div class="border-t pt-3" style="border-color: var(--color-border-muted)">
            <button
              type="button"
              class="flex w-full cursor-pointer items-center justify-between text-xs font-medium transition-colors hover:opacity-90"
              style="color: var(--color-text-secondary)"
              @click="showAdvancedAuth = !showAdvancedAuth"
            >
              <span>自定义认证字段与请求头（可选）</span>
              <span class="text-[11px]" style="color: var(--color-text-tertiary)">
                {{ showAdvancedAuth ? '收起 ▲' : '展开 ▼' }}
              </span>
            </button>

            <div v-if="showAdvancedAuth" class="mt-3 space-y-3 rounded-lg border p-3" style="border-color: var(--color-border-muted); background: var(--color-bg-base)">
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="block space-y-1">
                  <span class="text-[11px] font-medium" style="color: var(--color-text-secondary)">认证请求头名称 (Auth Header)</span>
                  <input
                    v-model="form.authHeaderName"
                    type="text"
                    class="w-full rounded-md border px-2.5 py-1.5 font-mono text-xs outline-none focus:border-indigo-500"
                    style="background: var(--color-bg-elevated); border-color: var(--color-border-default); color: var(--color-text-primary)"
                    placeholder="留空默认 Authorization，如 api-key / X-API-Key"
                  />
                </label>

                <label class="block space-y-1">
                  <span class="text-[11px] font-medium" style="color: var(--color-text-secondary)">认证前缀 (Prefix)</span>
                  <input
                    v-model="form.authHeaderPrefix"
                    type="text"
                    class="w-full rounded-md border px-2.5 py-1.5 font-mono text-xs outline-none focus:border-indigo-500"
                    style="background: var(--color-bg-elevated); border-color: var(--color-border-default); color: var(--color-text-primary)"
                    placeholder="默认 Bearer，若直接传 Key 请清空"
                  />
                </label>
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-medium" style="color: var(--color-text-secondary)">附加自定义请求头 (Custom Headers)</span>
                  <button
                    type="button"
                    class="cursor-pointer rounded border px-2 py-0.5 text-[11px] hover:bg-white/[0.04]"
                    style="border-color: var(--color-border-default); color: var(--color-accent-hover)"
                    @click="addCustomHeaderRow"
                  >
                    + 添加请求头
                  </button>
                </div>

                <div v-for="(row, idx) in form.customHeaderRows" :key="idx" class="flex items-center gap-2">
                  <input
                    v-model="row.key"
                    type="text"
                    class="w-40 rounded-md border px-2.5 py-1 font-mono text-xs outline-none focus:border-indigo-500"
                    style="background: var(--color-bg-elevated); border-color: var(--color-border-default); color: var(--color-text-primary)"
                    placeholder="Header 名，如 X-Org-Id"
                  />
                  <input
                    v-model="row.value"
                    type="text"
                    class="min-w-0 flex-1 rounded-md border px-2.5 py-1 font-mono text-xs outline-none focus:border-indigo-500"
                    style="background: var(--color-bg-elevated); border-color: var(--color-border-default); color: var(--color-text-primary)"
                    placeholder="Header 值"
                  />
                  <button
                    type="button"
                    class="cursor-pointer rounded border px-2 py-1 text-[11px] hover:bg-white/[0.04]"
                    style="border-color: var(--color-border-default); color: var(--color-error)"
                    @click="removeCustomHeaderRow(idx)"
                  >
                    移除
                  </button>
                </div>

                <p v-if="!form.customHeaderRows.length" class="text-[11px]" style="color: var(--color-text-tertiary)">
                  适用于需要额外鉴权字段（如 api-key、X-Auth-Token 或网关租户头）的自定义接口。
                </p>
              </div>
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
            v-if="quickStatus !== 'idle'"
            class="space-y-2 rounded-md border p-3"
            style="background: var(--color-bg-base)"
            :style="{
              borderColor:
                quickStatus === 'success'
                  ? 'rgba(16, 185, 129, 0.35)'
                  : quickStatus === 'error'
                    ? 'rgba(239, 68, 68, 0.35)'
                    : 'var(--color-border-muted)'
            }"
          >
            <div class="flex items-center justify-between text-[11px]">
              <span
                :style="{
                  color:
                    quickStatus === 'success'
                      ? 'var(--color-success)'
                      : quickStatus === 'error'
                        ? 'var(--color-error)'
                        : 'var(--color-text-secondary)'
                }"
              >
                {{
                  quickStatus === 'loading'
                    ? '⏳ 正在请求模型响应…'
                    : quickStatus === 'success'
                      ? `✓ 对话成功 (${quickLatencyMs}ms)`
                      : '✕ 请求失败'
                }}
              </span>
              <span v-if="selectedProfile?.model" class="font-mono" style="color: var(--color-text-tertiary)">
                {{ selectedProfile.model }}
              </span>
            </div>
            <div
              v-if="quickError || quickReply"
              class="font-mono text-xs leading-5 whitespace-pre-wrap"
              :style="{ color: quickError ? 'var(--color-error)' : 'var(--color-text-primary)' }"
            >
              {{ quickError || quickReply }}
            </div>
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
