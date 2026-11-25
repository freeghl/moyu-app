import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { BackgroundPreferences } from '@shared/types'

const STORAGE_KEY = 'moyu.background.v1'
export const DEFAULT_BACKGROUND_OPACITY = 70
export const DEFAULT_BACKGROUND_BLUR = 12

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

export const useSettingsStore = defineStore('settings', () => {
  const fileName = ref('')
  const originalName = ref('')
  const imageUrl = ref('')
  const opacity = ref(DEFAULT_BACKGROUND_OPACITY)
  const blur = ref(DEFAULT_BACKGROUND_BLUR)

  const appliedFileName = ref('')
  const appliedOriginalName = ref('')
  const appliedImageUrl = ref('')
  const appliedOpacity = ref(DEFAULT_BACKGROUND_OPACITY)
  const appliedBlur = ref(DEFAULT_BACKGROUND_BLUR)

  const isLoading = ref(false)
  const error = ref('')
  let initialized = false

  const hasBackground = computed(() => Boolean(appliedImageUrl.value))
  const hasDraftBackground = computed(() => Boolean(imageUrl.value))
  const isDirty = computed(() => (
    fileName.value !== appliedFileName.value
    || originalName.value !== appliedOriginalName.value
    || imageUrl.value !== appliedImageUrl.value
    || opacity.value !== appliedOpacity.value
    || blur.value !== appliedBlur.value
  ))

  function persist(): void {
    const preferences: BackgroundPreferences = {
      fileName: appliedFileName.value,
      originalName: appliedOriginalName.value,
      opacity: appliedOpacity.value,
      blur: appliedBlur.value
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    } catch {
      return
    }
  }

  function restoreDraft(): void {
    fileName.value = appliedFileName.value
    originalName.value = appliedOriginalName.value
    imageUrl.value = appliedImageUrl.value
    opacity.value = appliedOpacity.value
    blur.value = appliedBlur.value
  }

  async function removeStagedFile(fileNameToRemove: string): Promise<void> {
    if (!fileNameToRemove || fileNameToRemove === appliedFileName.value || !window.api?.background) return
    await window.api.background.remove(fileNameToRemove).catch(() => undefined)
  }

  async function init(): Promise<void> {
    if (initialized) return
    initialized = true

    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as Partial<BackgroundPreferences>
        appliedFileName.value = typeof saved.fileName === 'string' ? saved.fileName : ''
        appliedOriginalName.value = typeof saved.originalName === 'string' ? saved.originalName : ''
        appliedOpacity.value = clamp(saved.opacity, DEFAULT_BACKGROUND_OPACITY, 0, 100)
        appliedBlur.value = clamp(saved.blur, DEFAULT_BACKGROUND_BLUR, 0, 40)
      }
    } catch {
      appliedFileName.value = ''
      appliedOriginalName.value = ''
    }

    if (!appliedFileName.value) {
      restoreDraft()
      return
    }
    if (!window.api?.background) {
      appliedFileName.value = ''
      appliedOriginalName.value = ''
      restoreDraft()
      persist()
      return
    }

    isLoading.value = true
    try {
      const image = await window.api.background.load(appliedFileName.value)
      if (image) {
        appliedImageUrl.value = image.dataUrl
        appliedOriginalName.value = image.originalName
      } else {
        appliedFileName.value = ''
        appliedOriginalName.value = ''
        appliedImageUrl.value = ''
        error.value = '之前设置的背景图片已不存在，请重新选择。'
        persist()
      }
    } catch {
      appliedFileName.value = ''
      appliedOriginalName.value = ''
      appliedImageUrl.value = ''
      error.value = '背景图片读取失败，请重新选择。'
      persist()
    } finally {
      isLoading.value = false
      restoreDraft()
    }
  }

  async function selectBackground(): Promise<void> {
    if (!window.api?.background) {
      error.value = '当前环境不支持选择本地图片。'
      return
    }

    error.value = ''
    isLoading.value = true
    try {
      const image = await window.api.background.select()
      if (!image) return

      const previousDraftFileName = fileName.value
      fileName.value = image.fileName
      originalName.value = image.originalName
      imageUrl.value = image.dataUrl

      if (previousDraftFileName && previousDraftFileName !== image.fileName) {
        await removeStagedFile(previousDraftFileName)
      }
    } catch (selectionError) {
      error.value = selectionError instanceof Error ? selectionError.message : '选择图片失败，请重试。'
    } finally {
      isLoading.value = false
    }
  }

  function setOpacity(value: number): void {
    opacity.value = clamp(value, DEFAULT_BACKGROUND_OPACITY, 0, 100)
  }

  function setBlur(value: number): void {
    blur.value = clamp(value, DEFAULT_BACKGROUND_BLUR, 0, 40)
  }

  function resetParameters(): void {
    opacity.value = DEFAULT_BACKGROUND_OPACITY
    blur.value = DEFAULT_BACKGROUND_BLUR
  }

  async function removeBackground(): Promise<void> {
    const removedFileName = fileName.value
    fileName.value = ''
    originalName.value = ''
    imageUrl.value = ''
    error.value = ''
    await removeStagedFile(removedFileName)
  }

  async function applyBackground(): Promise<void> {
    if (!isDirty.value || isLoading.value) return

    const previousFileName = appliedFileName.value
    appliedFileName.value = fileName.value
    appliedOriginalName.value = originalName.value
    appliedImageUrl.value = imageUrl.value
    appliedOpacity.value = opacity.value
    appliedBlur.value = blur.value
    error.value = ''
    persist()

    if (previousFileName && previousFileName !== appliedFileName.value && window.api?.background) {
      await window.api.background.remove(previousFileName).catch(() => undefined)
    }
  }

  async function cancelChanges(): Promise<void> {
    if (!isDirty.value || isLoading.value) return

    const discardedFileName = fileName.value
    restoreDraft()
    error.value = ''
    await removeStagedFile(discardedFileName)
  }

  return {
    fileName,
    originalName,
    imageUrl,
    opacity,
    blur,
    appliedFileName,
    appliedOriginalName,
    appliedImageUrl,
    appliedOpacity,
    appliedBlur,
    isLoading,
    error,
    hasBackground,
    hasDraftBackground,
    isDirty,
    init,
    selectBackground,
    setOpacity,
    setBlur,
    resetParameters,
    removeBackground,
    applyBackground,
    cancelChanges
  }
})
