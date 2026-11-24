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

/** 工具改名后把旧 id 的数据接过来，避免用户重启后丢掉标签和工具内状态 */
const LEGACY_TOOL_IDS: Record<string, string> = {
  'moyu-resources': 'reference-peek'
}

function migrateToolIds(preferences: AppPreferences): boolean {
  let changed = false
  const map = (id: string): string => {
    const next = LEGACY_TOOL_IDS[id]
    if (!next) return id
    changed = true
    return next
  }

  preferences.session.tabs = preferences.session.tabs.map(map)
  if (preferences.session.activeToolId) preferences.session.activeToolId = map(preferences.session.activeToolId)
  preferences.favorites = Array.from(new Set(preferences.favorites.map(map)))
  preferences.recentTools = Array.from(new Set(preferences.recentTools.map(map)))

  for (const [legacyId, nextId] of Object.entries(LEGACY_TOOL_IDS)) {
    const legacyState = preferences.tools[legacyId]
    if (!legacyState) continue
    if (!preferences.tools[nextId]) preferences.tools[nextId] = legacyState
    delete preferences.tools[legacyId]
    changed = true
  }

  return changed
}

export const usePrefsStore = defineStore('prefs', () => {
  const state = ref<AppPreferences>(createDefaultPreferences())
  const ready = ref(false)

  let pending: PreferencesPatch | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  /** 读取磁盘偏好；失败时用默认值启动，不阻塞界面 */
  async function init(): Promise<void> {
    try {
      const saved = await window.api?.prefs.get()
      if (saved) {
        const migrated = migrateToolIds(saved)
        state.value = saved
        if (migrated) {
          pending = mergePatches(pending, {
            session: saved.session,
            favorites: saved.favorites,
            recentTools: saved.recentTools,
            tools: saved.tools
          })
          void flush()
        }
      }
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
