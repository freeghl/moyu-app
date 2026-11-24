import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createDefaultPreferences,
  mergePatches,
  mergePreferences,
  type AppPreferences,
  type PreferencesPatch,
  type ToolState
} from '@shared/preferences'

const FLUSH_DELAY = 250

export const usePrefsStore = defineStore('prefs', () => {
  const state = ref<AppPreferences>(createDefaultPreferences())
  const ready = ref(false)

  let pending: PreferencesPatch | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  /** 读取磁盘偏好；失败时用默认值启动，不阻塞界面 */
  async function init(): Promise<void> {
    try {
      const saved = await window.api?.prefs.get()
      if (saved) state.value = saved
    } catch {
      // 忽略，使用默认偏好
    }
    ready.value = true
  }

  function patch(next: PreferencesPatch): void {
    state.value = mergePreferences(state.value, next)
    pending = mergePatches(pending, next)
    clearTimeout(timer)
    timer = setTimeout(() => {
      void flush()
    }, FLUSH_DELAY)
  }

  async function flush(): Promise<void> {
    const next = pending
    pending = undefined
    if (!next || !window.api?.prefs) return
    try {
      // 补丁来自响应式对象，IPC 结构化克隆无法处理 Proxy，先转成纯 JSON 数据
      const plain = JSON.parse(JSON.stringify(next)) as PreferencesPatch
      await window.api.prefs.patch(plain)
    } catch {
      // 落盘失败时保留内存态，下次改动会重试
    }
  }

  function toolState(toolId: string): ToolState | undefined {
    return state.value.tools[toolId]
  }

  function saveToolState(toolId: string, value: ToolState): void {
    patch({ tools: { [toolId]: value } })
  }

  return { state, ready, init, patch, flush, toolState, saveToolState }
})
