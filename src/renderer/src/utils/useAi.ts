import { computed, onBeforeUnmount, ref } from 'vue'
import type { AiChatResponse, AiMessage } from '@shared/ai'
import { useAiStore } from '../stores/aiStore'
import { useTabStore } from '../stores/tabStore'

export interface AskAiOptions {
  profileId?: string
  temperature?: number
}

/**
 * 供任意插件/工具直接复用的 AI 调用 Composable
 * 自动绑定全局 AI 配置中心（aiStore），支持普通对话、流式输出、取消和跳转配置页
 */
export function useAi() {
  const aiStore = useAiStore()
  const tabStore = useTabStore()

  const loading = ref(false)
  const error = ref('')
  let activeRequestId: string | null = null
  let unsubscribeChunk: (() => void) | null = null

  function cleanupStream(): void {
    unsubscribeChunk?.()
    unsubscribeChunk = null
    activeRequestId = null
  }

  function openConfig(): void {
    tabStore.openTool('ai-config')
  }

  async function ask(messages: AiMessage[], options: AskAiOptions = {}): Promise<AiChatResponse> {
    if (!window.api?.ai) throw new Error('AI 接口未就绪')
    if (!aiStore.isConfigured && !options.profileId) {
      throw new Error('尚未配置可用的 AI 模型，请先前往「AI 模型配置」添加')
    }

    error.value = ''
    loading.value = true
    const requestId = crypto.randomUUID()
    activeRequestId = requestId

    try {
      return await window.api.ai.chat({
        requestId,
        profileId: options.profileId,
        messages,
        temperature: options.temperature
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      if (activeRequestId === requestId) activeRequestId = null
      loading.value = false
    }
  }

  async function askStream(
    messages: AiMessage[],
    onDelta: (delta: string) => void,
    options: AskAiOptions = {}
  ): Promise<void> {
    if (!window.api?.ai) throw new Error('AI 接口未就绪')
    if (!aiStore.isConfigured && !options.profileId) {
      throw new Error('尚未配置可用的 AI 模型，请先前往「AI 模型配置」添加')
    }

    cleanupStream()
    error.value = ''
    loading.value = true
    const requestId = crypto.randomUUID()
    activeRequestId = requestId

    await new Promise<void>((resolve, reject) => {
      unsubscribeChunk = window.api!.ai.onStreamChunk((chunk) => {
        if (chunk.requestId !== requestId) return
        if (chunk.delta) onDelta(chunk.delta)
        if (chunk.done) {
          cleanupStream()
          loading.value = false
          if (chunk.error) {
            error.value = chunk.error
            reject(new Error(chunk.error))
          } else {
            resolve()
          }
        }
      })

      window.api!.ai
        .chatStream({
          requestId,
          profileId: options.profileId,
          messages,
          temperature: options.temperature
        })
        .catch((err) => {
          cleanupStream()
          loading.value = false
          const message = err instanceof Error ? err.message : String(err)
          error.value = message
          reject(new Error(message))
        })
    })
  }

  function stop(): void {
    if (activeRequestId && window.api?.ai) {
      void window.api.ai.abort(activeRequestId)
    }
    cleanupStream()
    loading.value = false
  }

  onBeforeUnmount(() => {
    stop()
  })

  return {
    profiles: computed(() => aiStore.enabledProfiles),
    defaultProfile: computed(() => aiStore.defaultProfile),
    isConfigured: computed(() => aiStore.isConfigured),
    loading,
    error,
    ask,
    askStream,
    stop,
    openConfig
  }
}
