<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type {
  MoyuPreviewRequest,
  MoyuSite,
  MoyuSiteChange,
  MoyuSiteChangeResult,
  PreviewRect,
  PreviewState
} from '@shared/moyuPreview'
import { useTabStore } from '../../../stores'
import { useToolState } from '../../../utils/useToolState'
import WebsiteManager from './WebsiteManager.vue'

const CHROME_HEIGHT = 34

const DEFAULT_CODE = `export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
}

formatDuration(90)
`

const tabStore = useTabStore()
const state = useToolState('moyu-resources', { code: DEFAULT_CODE, siteId: '' })

const active = computed(() => tabStore.activeTab?.toolId === 'moyu-resources')
const sites = ref<MoyuSite[] | null>(null)
const loadingSites = ref(false)
const editor = ref<HTMLTextAreaElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const picker = ref<HTMLElement | null>(null)
const pickerOpen = ref(false)
const managerOpen = ref(false)
const scrollTop = ref(0)
const previewError = ref('')

const preview = ref<PreviewState>({ phase: 'hidden', pinned: false, fullscreen: false })

const code = computed({
  get: () => state.value.code,
  set: (value: string) => {
    state.value.code = value
  }
})

const selectedId = computed({
  get: () => state.value.siteId,
  set: (value: string) => {
    state.value.siteId = value
  }
})

const selectedSite = computed(() => sites.value?.find((site) => site.id === selectedId.value))
const lineCount = computed(() => code.value.split('\n').length)

let hoverTimer: ReturnType<typeof setTimeout> | undefined
let unsubscribeState: (() => void) | undefined

function rect(element: HTMLElement): PreviewRect {
  const { x, y, width, height } = element.getBoundingClientRect()
  return { x, y, width, height }
}

function cancelHover(): void {
  clearTimeout(hoverTimer)
  hoverTimer = undefined
}

async function showPreview(mode: 'peek' | 'pinned'): Promise<void> {
  const api = window.api?.moyuPreview
  const element = editor.value
  const siteId = selectedId.value
  if (!api || !element || !siteId) return

  const request: MoyuPreviewRequest = {
    siteId,
    editor: rect(element),
    chromeTop: CHROME_HEIGHT,
    mode
  }

  if (mode === 'peek') {
    if (!trigger.value) return
    request.trigger = rect(trigger.value)
  } else {
    pickerOpen.value = false
  }

  previewError.value = ''
  try {
    await api.show(request)
  } catch {
    previewError.value = '站点加载失败，请检查网络后重试'
  }
}

function queuePreview(event: PointerEvent): void {
  if (event.pointerType === 'touch' || event.pointerType === 'pen') return
  if (!active.value || pickerOpen.value || managerOpen.value || !selectedId.value) return
  if (preview.value.phase !== 'hidden') return

  cancelHover()
  hoverTimer = setTimeout(() => {
    hoverTimer = undefined
    void showPreview('peek')
  }, 300)
}

function hidePreview(): void {
  cancelHover()
  previewError.value = ''
  void window.api?.moyuPreview.hide()
}

function togglePinned(): void {
  cancelHover()
  if (preview.value.phase === 'hidden') {
    void showPreview('pinned')
    return
  }
  if (preview.value.pinned) {
    void window.api?.moyuPreview.command('close')
    return
  }
  void window.api?.moyuPreview.pin(true)
}

function runCommand(command: 'back' | 'forward' | 'reload' | 'fullscreen' | 'close'): void {
  void window.api?.moyuPreview.command(command)
}

function togglePinState(): void {
  if (preview.value.pinned) {
    runCommand('close')
    return
  }
  void window.api?.moyuPreview.pin(true)
}

function togglePicker(): void {
  hidePreview()
  pickerOpen.value = !pickerOpen.value
}

function chooseSite(id: string): void {
  selectedId.value = id
  pickerOpen.value = false
  previewError.value = ''
  trigger.value?.focus()
  void showPreview('pinned')
}

function updateSites(updated: MoyuSite[], newSelection?: string): void {
  sites.value = updated
  const preferred = newSelection ?? selectedId.value
  const next = updated.find((site) => site.id === preferred)?.id ?? updated[0]?.id ?? ''
  selectedId.value = next
}

async function saveChange(change: MoyuSiteChange): Promise<MoyuSiteChangeResult> {
  const api = window.api?.moyuPreview
  if (!api) return { error: '网站管理不可用' }
  const result = await api.changeSite(change)
  if ('sites' in result) updateSites(result.sites, result.selectedId)
  return result
}

async function loadSites(): Promise<void> {
  const api = window.api?.moyuPreview
  if (!api || loadingSites.value) return
  loadingSites.value = true
  try {
    updateSites(await api.listSites())
  } catch {
    sites.value = null
  } finally {
    loadingSites.value = false
  }
}

function openManager(): void {
  hidePreview()
  pickerOpen.value = false
  managerOpen.value = true
}

function closeManager(): void {
  managerOpen.value = false
  void nextTick(() => trigger.value?.focus())
}

function closePickerOnBlur(event: FocusEvent): void {
  if (event.relatedTarget instanceof Node && picker.value?.contains(event.relatedTarget)) return
  pickerOpen.value = false
}

function handleEditorKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    togglePinned()
    return
  }
  if (event.key === 'Escape') {
    hidePreview()
    return
  }
  if (event.key === 'Tab') {
    event.preventDefault()
    const element = editor.value
    if (!element) return
    const start = element.selectionStart
    const end = element.selectionEnd
    const next = `${element.value.slice(0, start)}  ${element.value.slice(end)}`
    code.value = next
    void nextTick(() => {
      element.selectionStart = start + 2
      element.selectionEnd = start + 2
    })
  }
}

watch(active, (isActive) => {
  if (isActive) return
  pickerOpen.value = false
  hidePreview()
}, { flush: 'sync' })

watch(managerOpen, (open) => {
  if (open) hidePreview()
})

onMounted(() => {
  unsubscribeState = window.api?.moyuPreview.onState((next) => {
    preview.value = next
    if (next.phase === 'ready' || next.phase === 'hidden') previewError.value = ''
  })
  void loadSites()
})

onBeforeUnmount(() => {
  unsubscribeState?.()
  hidePreview()
})
</script>

<template>
  <section class="flex h-full min-h-0 flex-col bg-(--color-bg-base)" @keydown.esc="hidePreview">
    <WebsiteManager
      v-if="managerOpen"
      :sites="sites"
      :loading="loadingSites"
      :save-change="saveChange"
      @reload="loadSites"
      @close="closeManager"
    />

    <template v-else>
      <header class="flex h-9 shrink-0 items-center gap-3 border-b border-(--color-border-muted) px-4 text-xs text-(--color-text-secondary)">
        <span class="font-mono">format-duration.ts</span>

        <span class="ml-auto flex items-center gap-1.5 text-[11px] text-(--color-text-tertiary)">
          <span>悬停左下角 ⋯ 快速预览</span>
          <span class="opacity-40">·</span>
          <span class="kbd-badge">Ctrl</span>
          <span class="kbd-badge">Enter</span>
          <span>钉住预览</span>
        </span>

        <div class="flex items-center gap-1.5">
          <span class="max-w-[160px] truncate rounded-md border border-(--color-border-default) px-2 py-1 text-[11px]" :title="selectedSite?.name">
            {{ selectedSite?.name ?? '选择站点' }}
          </span>
          <button
            type="button"
            class="cursor-pointer rounded-md border border-(--color-border-default) px-2 py-1 text-[11px] hover:bg-(--color-bg-surface)"
            @click="openManager"
          >管理网站</button>
          <button
            type="button"
            class="cursor-pointer rounded-md border px-2 py-1 text-[11px] transition-colors"
            :style="{
              borderColor: preview.phase === 'hidden' ? 'var(--color-border-default)' : 'var(--color-accent)',
              color: preview.phase === 'hidden' ? 'var(--color-text-secondary)' : 'var(--color-accent-hover)'
            }"
            @click="togglePinned"
          >
            {{ preview.phase === 'hidden' ? '预览' : preview.pinned ? '关闭预览' : '钉住' }}
          </button>
        </div>
      </header>

      <div class="flex min-h-0 flex-1 font-mono text-sm leading-6">
        <div class="relative w-12 shrink-0 bg-(--color-bg-elevated) text-(--color-text-tertiary)">
          <div class="absolute inset-x-0 top-0 bottom-8 overflow-hidden" aria-hidden="true">
            <div class="pt-3 pr-3 text-right" :style="{ transform: 'translateY(-' + scrollTop + 'px)' }">
              <div v-for="line in lineCount" :key="line">{{ line }}</div>
            </div>
          </div>

          <div ref="picker" class="absolute inset-x-0 bottom-0" @focusout="closePickerOnBlur" @keydown.esc="pickerOpen = false; trigger?.focus()">
            <button
              ref="trigger"
              type="button"
              class="block h-8 w-full cursor-pointer hover:bg-(--color-bg-overlay) focus-visible:bg-(--color-bg-overlay)"
              aria-label="选择预览站点"
              :aria-expanded="pickerOpen"
              @pointerenter="queuePreview"
              @pointerleave="cancelHover"
              @click="togglePicker"
            >⋯</button>
            <ul v-if="pickerOpen" class="absolute bottom-full left-1 z-20 max-h-[60vh] w-52 overflow-auto rounded-md border border-(--color-border-default) bg-(--color-bg-surface) p-1 text-xs shadow-xl">
              <li v-for="item in sites" :key="item.id">
                <button
                  type="button"
                  class="w-full cursor-pointer rounded px-2 py-1.5 text-left hover:bg-(--color-bg-overlay) focus-visible:bg-(--color-bg-overlay)"
                  :class="item.id === selectedId ? 'text-(--color-accent-hover)' : 'text-(--color-text-secondary)'"
                  :aria-pressed="item.id === selectedId"
                  @click="chooseSite(item.id)"
                >{{ item.name }}</button>
              </li>
              <li class="border-t border-(--color-border-default)">
                <button type="button" class="w-full cursor-pointer rounded px-2 py-1.5 text-left text-(--color-text-secondary) hover:bg-(--color-bg-overlay) focus-visible:bg-(--color-bg-overlay)" @click="openManager">管理网站</button>
              </li>
            </ul>
          </div>
        </div>

        <div class="relative min-w-0 flex-1">
          <!-- 预览控制条：故意留出顶部高度，让 WebContentsView 从下方开始 -->
          <div
            v-if="preview.phase !== 'hidden'"
            class="absolute inset-x-0 top-0 z-10 flex items-center gap-1.5 border-b border-(--color-border-default) bg-(--color-bg-surface) px-3 text-[11px]"
            :style="{ height: CHROME_HEIGHT + 'px' }"
          >
            <span class="flex items-center gap-1.5 text-(--color-text-secondary)">
              <span
                class="inline-block h-1.5 w-1.5 rounded-full"
                :style="{ background: preview.phase === 'ready' ? 'var(--color-success)' : preview.phase === 'error' ? 'var(--color-error)' : 'var(--color-warning)' }"
              ></span>
              {{ preview.phase === 'loading' ? '加载中…' : preview.phase === 'error' ? '加载失败' : selectedSite?.name ?? '预览' }}
            </span>

            <span v-if="preview.pinned" class="rounded bg-(--color-accent-muted) px-1.5 py-0.5 text-(--color-accent-hover)">已钉住</span>

            <div class="ml-auto flex items-center gap-0.5">
              <button type="button" class="cursor-pointer rounded px-1.5 py-1 hover:bg-(--color-bg-overlay)" title="后退 (Alt + ←)" @click="runCommand('back')">←</button>
              <button type="button" class="cursor-pointer rounded px-1.5 py-1 hover:bg-(--color-bg-overlay)" title="前进 (Alt + →)" @click="runCommand('forward')">→</button>
              <button type="button" class="cursor-pointer rounded px-1.5 py-1 hover:bg-(--color-bg-overlay)" title="刷新 (Ctrl + R)" @click="runCommand('reload')">⟳</button>
              <button
                type="button"
                class="cursor-pointer rounded px-1.5 py-1 hover:bg-(--color-bg-overlay)"
                :class="{ 'text-(--color-accent-hover)': preview.pinned }"
                :title="preview.pinned ? '取消钉住' : '钉住预览'"
                @click="togglePinState"
              >📌</button>
              <button type="button" class="cursor-pointer rounded px-1.5 py-1 hover:bg-(--color-bg-overlay)" title="全屏（Esc 退出）" @click="runCommand('fullscreen')">⛶</button>
              <button type="button" class="cursor-pointer rounded px-1.5 py-1 text-(--color-error) hover:bg-(--color-bg-overlay)" title="关闭预览 (Esc)" @click="runCommand('close')">✕</button>
            </div>
          </div>

          <!-- 加载骨架屏：视图就绪前 WebContentsView 不可见，用骨架屏填补空白 -->
          <div
            v-if="preview.phase === 'loading'"
            class="absolute inset-x-0 z-10 flex flex-col gap-2 overflow-hidden bg-(--color-bg-base) px-4 py-4"
            :style="{ top: CHROME_HEIGHT + 'px', bottom: 0 }"
            aria-hidden="true"
          >
            <div class="skeleton h-3 w-1/3 rounded"></div>
            <div class="skeleton h-3 w-2/3 rounded"></div>
            <div class="skeleton h-3 w-1/2 rounded"></div>
            <div class="skeleton mt-2 h-24 w-full rounded"></div>
            <div class="skeleton h-3 w-3/5 rounded"></div>
            <div class="skeleton h-3 w-2/5 rounded"></div>
          </div>

          <div
            v-if="previewError || preview.phase === 'error'"
            class="absolute inset-x-0 z-10 flex flex-col items-start gap-2 bg-(--color-bg-base) px-4 py-4 text-xs"
            :style="{ top: CHROME_HEIGHT + 'px', bottom: 0 }"
          >
            <p role="alert" class="text-(--color-error)">{{ previewError || '站点加载失败，请检查网络后重试' }}</p>
            <button type="button" class="cursor-pointer text-(--color-accent-hover) hover:underline" @click="showPreview('pinned')">重试</button>
          </div>

          <textarea
            ref="editor"
            v-model="code"
            class="h-full w-full resize-none px-4 py-3 text-(--color-text-primary) outline-none"
            aria-label="TypeScript 代码编辑区"
            wrap="off"
            spellcheck="false"
            @scroll="scrollTop = editor?.scrollTop ?? 0"
            @pointerdown="pickerOpen = false"
            @keydown="handleEditorKeydown"
          />
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.skeleton {
  background: linear-gradient(90deg, var(--color-bg-elevated) 25%, var(--color-bg-overlay) 37%, var(--color-bg-elevated) 63%);
  background-size: 400% 100%;
  animation: skeleton-loading 1.4s ease infinite;
}

@keyframes skeleton-loading {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}
</style>
