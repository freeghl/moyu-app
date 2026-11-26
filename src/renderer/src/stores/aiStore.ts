import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AiConfigState, AiModelListResult, AiProfileInput, AiTestResult } from '@shared/ai'

export const useAiStore = defineStore('ai', () => {
  const config = ref<AiConfigState>({ defaultProfileId: null, profiles: [] })
  const ready = ref(false)
  const loading = ref(false)

  const profiles = computed(() => config.value.profiles)
  const enabledProfiles = computed(() => config.value.profiles.filter((item) => item.enabled))
  const defaultProfileId = computed(() => config.value.defaultProfileId)

  const defaultProfile = computed(() => {
    const id = config.value.defaultProfileId
    if (id) {
      const matched = config.value.profiles.find((item) => item.id === id && item.enabled)
      if (matched) return matched
    }
    return enabledProfiles.value[0] ?? null
  })

  const isConfigured = computed(() => Boolean(defaultProfile.value))

  async function init(): Promise<void> {
    if (ready.value || !window.api?.ai) {
      ready.value = true
      return
    }
    loading.value = true
    try {
      config.value = await window.api.ai.getConfig()
    } catch {
      // 忽略启动时加载异常，保持空配置
    } finally {
      loading.value = false
      ready.value = true
    }
  }

  async function refresh(): Promise<void> {
    if (!window.api?.ai) return
    config.value = await window.api.ai.getConfig()
  }

  async function saveProfile(input: AiProfileInput): Promise<AiConfigState> {
    if (!window.api?.ai) throw new Error('AI 接口未就绪')
    config.value = await window.api.ai.saveProfile(input)
    return config.value
  }

  async function deleteProfile(id: string): Promise<AiConfigState> {
    if (!window.api?.ai) throw new Error('AI 接口未就绪')
    config.value = await window.api.ai.deleteProfile(id)
    return config.value
  }

  async function setDefault(id: string | null): Promise<AiConfigState> {
    if (!window.api?.ai) throw new Error('AI 接口未就绪')
    config.value = await window.api.ai.setDefault(id)
    return config.value
  }

  async function testConnection(input: AiProfileInput): Promise<AiTestResult> {
    if (!window.api?.ai) {
      return { ok: false, latencyMs: 0, message: 'AI 接口未就绪' }
    }
    return window.api.ai.testConnection(input)
  }

  async function listModels(input: AiProfileInput): Promise<AiModelListResult> {
    if (typeof window.api?.ai?.listModels !== 'function') {
      return { ok: false, models: [], message: 'AI 模型列表接口未就绪，请重启应用窗口后重试' }
    }
    return window.api.ai.listModels(input)
  }

  return {
    config,
    profiles,
    enabledProfiles,
    defaultProfileId,
    defaultProfile,
    isConfigured,
    ready,
    loading,
    init,
    refresh,
    saveProfile,
    deleteProfile,
    setDefault,
    testConnection,
    listModels
  }
})
