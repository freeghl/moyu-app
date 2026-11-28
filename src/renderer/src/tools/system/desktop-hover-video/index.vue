<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { usePrefsStore } from '../../../stores/prefsStore'
import {
  HOVER_VIDEO_SOURCE_IDS,
  HOVER_VIDEO_SOURCE_NAMES,
  type HoverVideoSourceId,
  type HoverVideoState
} from '@shared/hoverVideo'

const sourceOptions = HOVER_VIDEO_SOURCE_IDS.map((id) => ({ id, name: HOVER_VIDEO_SOURCE_NAMES[id] }))
const prefsStore = usePrefsStore()
const preferences = computed(() => prefsStore.state.hoverVideo)
const serviceState = ref<HoverVideoState | null>(null)
const busy = ref(false)
const errorMessage = ref('')
let unsubscribe: (() => void) | undefined

const apiAvailable = computed(() => Boolean(window.api?.hoverVideo))
const canStart = computed(() => preferences.value.hotspots.length > 0 && preferences.value.sources.length > 0)
const statusText = computed(() => {
  if (!preferences.value.enabled) return '未开启'
  if (!canStart.value) return '等待配置来源和热区'
  const activeSource = serviceState.value?.activeSource
  return {
    hidden: '后台监听中',
    loading: activeSource ? `正在加载${HOVER_VIDEO_SOURCE_NAMES[activeSource]}` : '正在加载推荐流',
    playing: activeSource ? `正在播放 ${HOVER_VIDEO_SOURCE_NAMES[activeSource]}` : '正在播放推荐视频',
    error: '加载失败'
  }[serviceState.value?.status ?? 'hidden']
})

function patch(patchValue: Parameters<typeof prefsStore.patch>[0]): void {
  prefsStore.patch(patchValue)
}

function toggleEnabled(): void {
  patch({ hoverVideo: { ...preferences.value, enabled: !preferences.value.enabled } })
}

function toggleMuted(): void {
  patch({ hoverVideo: { ...preferences.value, muted: !preferences.value.muted } })
}

function toggleSource(source: HoverVideoSourceId): void {
  const enabled = preferences.value.sources.includes(source)
  if (enabled && preferences.value.sources.length === 1) {
    errorMessage.value = '请至少保留一个视频来源。'
    return
  }
  errorMessage.value = ''
  patch({
    hoverVideo: {
      ...preferences.value,
      sources: enabled
        ? preferences.value.sources.filter((item) => item !== source)
        : [...preferences.value.sources, source]
    }
  })
}

async function openLogin(source: HoverVideoSourceId): Promise<void> {
  const api = window.api?.hoverVideo
  if (!api || busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    await api.openLogin(source)
  } catch (loginError) {
    errorMessage.value = loginError instanceof Error ? loginError.message : `打开 ${HOVER_VIDEO_SOURCE_NAMES[source]} 登录失败。`
  } finally {
    busy.value = false
  }
}

async function finishLogin(source: HoverVideoSourceId): Promise<void> {
  const api = window.api?.hoverVideo
  if (!api || busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    await api.finishLogin(source)
  } catch (loginError) {
    errorMessage.value = loginError instanceof Error ? loginError.message : '确认登录失败，请重试。'
  } finally {
    busy.value = false
  }
}

async function captureHotspot(): Promise<void> {
  const api = window.api?.hoverVideo
  if (!api || busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    const hotspot = await api.captureHotspot()
    patch({ hoverVideo: { ...preferences.value, hotspots: [...preferences.value.hotspots, hotspot] } })
  } catch (captureError) {
    errorMessage.value = captureError instanceof Error ? captureError.message : '记录热区失败，请重试。'
  } finally {
    busy.value = false
  }
}

async function removeHotspot(id: string): Promise<void> {
  const api = window.api?.hoverVideo
  if (!api || busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    await api.removeHotspot(id)
    patch({
      hoverVideo: {
        ...preferences.value,
        hotspots: preferences.value.hotspots.filter((hotspot) => hotspot.id !== id)
      }
    })
  } catch (removeError) {
    errorMessage.value = removeError instanceof Error ? removeError.message : '删除热区失败，请重试。'
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  unsubscribe = window.api?.hoverVideo?.onState((state) => {
    serviceState.value = state
  })
})

onBeforeUnmount(() => unsubscribe?.())
</script>

<template>
  <div class="h-full overflow-y-auto p-6 text-[var(--color-text-primary)]">
    <div class="mx-auto max-w-5xl space-y-5">
      <section class="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-accent-muted)] text-xs font-semibold tracking-wider text-[var(--color-accent-hover)]">
            VID
          </div>
          <div>
            <h1 class="text-lg font-semibold">桌面悬停视频</h1>
            <p class="mt-1 text-xs text-[var(--color-text-secondary)]">TikTok · 抖音 · 哔哩哔哩随机推荐 · 270 × 480 小浮层</p>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <div class="text-right">
            <div class="text-sm font-medium">{{ statusText }}</div>
            <div class="mt-1 text-[11px] text-[var(--color-text-tertiary)]">仅桌面图标热区触发</div>
          </div>
          <button
            type="button"
            role="switch"
            :aria-checked="preferences.enabled"
            :disabled="!apiAvailable"
            class="relative h-7 w-12 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            :class="preferences.enabled ? 'border-[var(--color-accent)] bg-[var(--color-accent)]' : 'border-[var(--panel-border)] bg-[var(--color-bg-muted)]'"
            @click="toggleEnabled"
          >
            <span
              class="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition-all"
              :class="preferences.enabled ? 'left-6' : 'left-1'"
            />
          </button>
        </div>
      </section>

      <section class="rounded-2xl border border-[var(--panel-border)] bg-[var(--color-accent-subtle)] px-5 py-4 text-xs leading-6 text-[var(--color-text-secondary)]">
        视频直接从已启用平台的公开推荐流随机获取，无需导入文件。鼠标停留约 0.2 秒开始播放，离开后自动隐藏；播放时可在设置中自定义快捷键切换上一条 / 下一条。
      </section>

      <div v-if="errorMessage || serviceState?.notice" class="rounded-xl border border-[var(--panel-border)] bg-[var(--color-bg-elevated)] px-4 py-3 text-xs leading-5 text-[var(--color-text-secondary)]">
        {{ errorMessage || serviceState?.notice }}
      </div>

      <div class="grid gap-5 lg:grid-cols-2">
        <section class="glass-panel rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5">
          <div>
            <h2 class="text-sm font-semibold">1. 视频来源</h2>
            <p class="mt-1 text-[11px] text-[var(--color-text-tertiary)]">已启用 {{ preferences.sources.length }} 个平台，每次触发随机选择</p>
          </div>

          <div class="mt-4 space-y-3">
            <div
              v-for="source in sourceOptions"
              :key="source.id"
              class="rounded-xl border border-[var(--panel-border)] bg-[var(--color-bg-elevated)] p-4"
            >
              <div class="flex items-center justify-between gap-3">
                <label class="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    :checked="preferences.sources.includes(source.id)"
                    class="h-4 w-4 accent-[var(--color-accent)]"
                    @change="toggleSource(source.id)"
                  />
                  <span class="text-xs font-medium">{{ source.name }}</span>
                </label>
                <span
                  class="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium"
                  :class="serviceState?.loginStates[source.id]
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-[var(--panel-border)] bg-[var(--color-bg-muted)] text-[var(--color-text-tertiary)]'"
                >
                  {{ serviceState?.loginStates[source.id] ? '已登录' : '公开推荐' }}
                </span>
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  :disabled="busy || !apiAvailable"
                  class="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                  @click="openLogin(source.id)"
                >
                  登录 {{ source.name }}
                </button>
                <button
                  type="button"
                  :disabled="busy || !apiAvailable"
                  class="rounded-lg border border-[var(--panel-border)] bg-[var(--color-bg-muted)] px-3 py-2 text-xs font-medium transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                  @click="finishLogin(source.id)"
                >
                  已完成登录
                </button>
              </div>
            </div>
          </div>

          <p class="mt-4 text-[11px] leading-5 text-[var(--color-text-tertiary)]">
            登录后优先读取个性化推荐，未登录也可播放公开内容。各平台登录态独立保存在本机，不会写入偏好文件。
          </p>

          <label class="mt-4 flex cursor-pointer items-center justify-between rounded-xl border border-[var(--panel-border)] bg-[var(--color-bg-elevated)] px-3 py-3">
            <span>
              <span class="block text-xs font-medium">播放声音</span>
              <span class="mt-1 block text-[10px] text-[var(--color-text-tertiary)]">默认静音，避免后台突然外放</span>
            </span>
            <input type="checkbox" :checked="!preferences.muted" class="h-4 w-4 accent-[var(--color-accent)]" @change="toggleMuted" />
          </label>
        </section>

        <section class="glass-panel rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-sm font-semibold">2. 桌面热区</h2>
              <p class="mt-1 text-[11px] text-[var(--color-text-tertiary)]">记录光标所在位置，共 {{ preferences.hotspots.length }} 个</p>
            </div>
            <button
              type="button"
              :disabled="busy || !apiAvailable"
              class="rounded-lg border border-[var(--panel-border)] bg-[var(--color-bg-muted)] px-3 py-2 text-xs font-medium transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              @click="captureHotspot"
            >
              记录当前位置
            </button>
          </div>

          <div v-if="preferences.hotspots.length" class="mt-4 space-y-2">
            <div
              v-for="hotspot in preferences.hotspots"
              :key="hotspot.id"
              class="flex items-center gap-3 rounded-xl border border-[var(--panel-border)] bg-[var(--color-bg-elevated)] px-3 py-3"
            >
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[10px] font-semibold text-[var(--color-accent-hover)]">
                {{ hotspot.width }}×{{ hotspot.height }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="truncate text-xs font-medium">{{ hotspot.name }}</div>
                <div class="mt-1 text-[10px] text-[var(--color-text-tertiary)]">X {{ hotspot.x }} · Y {{ hotspot.y }}</div>
              </div>
              <button
                type="button"
                :disabled="busy"
                class="rounded-md px-2 py-1 text-[11px] text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-error)] disabled:opacity-40"
                @click="removeHotspot(hotspot.id)"
              >
                删除
              </button>
            </div>
          </div>
          <div v-else class="mt-4 flex h-32 items-center justify-center rounded-xl border border-dashed border-[var(--panel-border)] text-center text-xs leading-6 text-[var(--color-text-tertiary)]">
            还没有热区<br />点击记录后，把鼠标移到桌面图标上
          </div>

          <div class="mt-4 rounded-xl border border-[var(--panel-border)] bg-[var(--color-bg-elevated)] px-3 py-3 text-[11px] leading-5 text-[var(--color-text-tertiary)]">
            记录时应用会最小化约 1.4 秒，然后自动回到设置页。热区保存的是桌面坐标，移动显示器或图标后需要重新记录。
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
