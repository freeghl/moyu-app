import { ref, watch, type Ref } from 'vue'
import { usePrefsStore } from '../stores/prefsStore'

/**
 * 为单个工具提供持久化状态：读写都会同步到 preferences.json。
 * 用法：const state = useToolState('json-formatter', { input: '', indent: 2 })
 */
export function useToolState<T extends Record<string, unknown>>(toolId: string, defaults: T): Ref<T> {
  const prefs = usePrefsStore()
  const cached = prefs.toolState(toolId) ?? {}
  const state = ref({ ...defaults, ...cached }) as Ref<T>

  watch(
    state,
    (value) => {
      prefs.saveToolState(toolId, { ...value })
    },
    { deep: true }
  )

  return state
}
