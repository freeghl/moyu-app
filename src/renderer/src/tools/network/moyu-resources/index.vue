<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PreviewRect, Site, SiteChange, SiteChangeResult, SitePreviewRequest, SitePreviewState } from '@shared/sitePreview'
import { useMoyuStore, useTabStore } from '../../../stores'
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
const moyu = useMoyuStore()
const state = useToolState('moyu-resources', {
  openSiteIds: [] as string[],
  activeSiteId: '',
  previewSiteId: '',
  code: DEFAULT_CODE
})

const active = computed(() => tabStore.activeTab?.toolId === 'moyu-resources')
const sites = ref<Site[] | null>(null)
const loadingSites = ref(false)
const managerOpen = ref(false)
const sitePickerOpen = ref(false)
const root = ref<HTMLElement | null>(null)
const previewArea = ref<HTMLElement | null>(null)
const editor = ref<HTMLTextAreaElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const scrollTop = ref(0)
const previewError = ref('')
const preview = ref<SitePreviewState>({ phase: 'hidden', pinned: false, fullscreen: false })

const openSites = computed(() => {
  const available = sites.value ?? []
  return state.value.openSiteIds
    .map((id) => available.find((site) => site.id === id))
    .filter((site): site is Site => Boolean(site))
})
const activeSite = computed(() => sites.value?.find((site) => site.id === state.value.activeSiteId))
const previewSite = computed(() => sites.value?.find((site) => site.id === state.value.previewSiteId) ?? activeSite.value)
const lineCount = computed(() => state.value.code.split('\n').length)

const code = computed({
  get: () => state.value.code,
  set: (value: string) => {
    state.value.code = value
  }
})

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

function updateSiteState(updated: Site[]): void {
  sites.value = updated
  const availableIds = new Set(updated.map((site) => site.id))
  const openIds = state.value.openSiteIds.filter((id) => availableIds.has(id))
  if (!openIds.length && updated[0]) openIds.push(updated[0].id)
  state.value.openSiteIds = openIds

  if (!openIds.includes(state.value.activeSiteId)) {
    state.value.activeSiteId = openIds[0] ?? ''
  }
  if (!availableIds.has(state.value.previewSiteId)) {
    state.value.previewSiteId = state.value.activeSiteId || updated[0]?.id || ''
  }
}

function openSite(id: string): void {
  if (!sites.value?.some((site) => site.id === id)) return
  if (!state.value.openSiteIds.includes(id)) state.value.openSiteIds.push(id)
  state.value.activeSiteId = id
  state.value.previewSiteId = id
  sitePickerOpen.value = false
  moyu.bossMode = false
  hidePreview()
}

function switchSite(id: string): void {
  state.value.activeSiteId = id
  state.value.previewSiteId = id
  hidePreview()
  updateAudio()
}

function closeSite(id: string): void {
  const index = state.value.openSiteIds.indexOf(id)
  if (index === -1) return
  state.value.openSiteIds.splice(index, 1)
  if (state.value.activeSiteId === id) {
    state.value.activeSiteId = state.value.openSiteIds[Math.min(index, state.value.openSiteIds.length - 1)] ?? ''
  }
  if (state.value.previewSiteId === id) {
    state.value.previewSiteId = state.value.activeSiteId || sites.value?.[0]?.id || ''
  }
  hidePreview()
  updateAudio()
}

function choosePreviewSite(id: string): void {
  state.value.previewSiteId = id
  sitePickerOpen.value = false
  trigger.value?.focus()
}

function updateAudio(): void {
  void nextTick(() => {
    root.value?.querySelectorAll('webview').forEach((element) => {
      const view = element as HTMLElement & { setAudioMuted?: (muted: boolean) => void }
      try {
        view.setAudioMuted?.(moyu.bossMode || element.id !== `moyu-site-${state.value.activeSiteId}`)
      } catch {
        // webview 尚未 ready
      }
    })
  })
}

async function showPreview(mode: 'peek' | 'pinned'): Promise<void> {
  const api = window.api?.sitePreview
  const element = previewArea.value
  const siteId = state.value.previewSiteId
  if (!api || !element || !siteId || !moyu.bossMode) return

  const request: SitePreviewRequest = {
    siteId,
    editor: rect(element),
    chromeTop: CHROME_HEIGHT,
    mode
  }
  if (mode === 'peek') {
    if (!trigger.value) return
    request.trigger = rect(trigger.value)
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
  if (!active.value || !moyu.bossMode || managerOpen.value || !state.value.previewSiteId) return
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
  void window.api?.sitePreview.hide()
}

function togglePinned(): void {
  cancelHover()
  if (preview.value.phase === 'hidden') {
    void showPreview('pinned')
    return
  }
  if (preview.value.pinned) void window.api?.sitePreview.command('close')
  else void window.api?.sitePreview.pin(true)
}

function runCommand(command: 'back' | 'forward' | 'reload' | 'fullscreen' | 'close'): void {
  void window.api?.sitePreview.command(command)
}

function togglePinState(): void {
  if (preview.value.pinned) runCommand('close')
  else void window.api?.sitePreview.pin(true)
}

async function saveChange(change: SiteChange): Promise<SiteChangeResult> {
  const api = window.api?.sitePreview
  if (!api) return { error: '网站管理不可用' }
  const result = await api.changeSite(change)
  if ('sites' in result) updateSiteState(result.sites)
  return result
}

async function loadSites(): Promise<void> {
  const api = window.api?.sitePreview
  if (!api || loadingSites.value) return
  loadingSites.value = true
  try {
    updateSiteState(await api.listSites())
  } catch {
    sites.value = null
  } finally {
    loadingSites.value = false
  }
}

function openManager(): void {
  hidePreview()
  sitePickerOpen.value = false
  managerOpen.value = true
}

function closeManager(): void {
  managerOpen.value = false
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
    code.value = `${state.value.code.slice(0, start)}  ${state.value.code.slice(end)}`
    void nextTick(() => {
      element.selectionStart = start + 2
      element.selectionEnd = start + 2
    })
  }
}

watch(active, (isActive) => {
  if (!isActive) {
    managerOpen.value = false
    sitePickerOpen.value = false
    hidePreview()
  }
}, { flush: 'sync' })

watch(() => moyu.bossMode, (bossMode) => {
  if (!bossMode) hidePreview()
  updateAudio()
})

watch(() => state.value.activeSiteId, updateAudio)

onMounted(async () => {
  unsubscribeState = window.api?.sitePreview.onState((next) => {
    preview.value = next
    if (next.phase === 'ready' || next.phase === 'hidden') previewError.value = ''
  })
  await loadSites()
  updateAudio()
})

onBeforeUnmount(() => {
  unsubscribeState?.()
  hidePreview()
})
</script>

<template>
  <section ref="root" class="flex h-full min-h-0 flex-col bg-(--color-bg-base)" @keydown.esc="hidePreview">
    <WebsiteManager
      v-if="managerOpen"
      :sites="sites"
      :loading="loadingSites"
      :save-change="saveChange"
      @reload="loadSites"
      @close="closeManager"
    />

    <template v-else>
      <header class="flex h-9 shrink-0 items-center gap-2 border-b border-(--color-border-muted) px-3 text-xs text-(--color-text-secondary)">
        <template v-if="!moyu.bossMode">
          <div class="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto">
            <div
              v-for="site in openSites"
              :key="site.id"
              class="flex h-8 max-w-52 shrink-0 cursor-pointer items-center gap-2 border-r border-(--color-border-muted) px-3"
              :class="site.id === state.activeSiteId ? 'bg-(--color-bg-base) text-(--color-text-primary)' : 'hover:bg-(--color-bg-overlay)'"
              @click="switchSite(site.id)"
            >
              <span class="truncate">{{ site.name }}</span>
              <button class="shrink-0 opacity-50 hover:opacity-100" title="关闭站点" @click.stop="closeSite(site.id)">×</button>
            </div>
          </div>

          <div class="relative shrink-0">
            <button class="rounded px-2 py-1 hover:bg-(--color-bg-overlay)" title="打开站点" @click="sitePickerOpen = !sitePickerOpen">＋ 站点</button>
            <ul v-if="sitePickerOpen" class="absolute right-0 top-full z-30 mt-1 max-h-72 w-60 overflow-auto rounded-md border border-(--color-border-default) bg-(--color-bg-surface) p-1 shadow-xl">
              <li v-for="site in sites" :key="site.id">
                <button class="w-full cursor-pointer rounded px-3 py-2 text-left text-xs hover:bg-(--color-bg-overlay)" @click="openSite(site.id)">{{ site.name }}</button>
              </li>
              <li class="border-t border-(--color-border-muted)">
                <button class="w-full cursor-pointer rounded px-3 py-2 text-left text-xs hover:bg-(--color-bg-overlay)" @click="openManager">管理网站…</button>
              </li>
            </ul>
          </div>
          <button class="shrink-0 rounded px-2 py-1 hover:bg-(--color-bg-overlay)" @click="openManager">管理网站</button>
          <button class="shrink-0 rounded px-2 py-1 text-(--color-accent-hover) hover:bg-(--color-bg-overlay)" @click="moyu.bossMode = true">老板模式</button>
        </template>

        <template v-else>
          <span class="min-w-0 flex-1 truncate font-mono">format-duration.ts</span>
          <span class="hidden text-[11px] whitespace-nowrap text-(--color-text-tertiary) xl:inline">悬停左下角 ⋯ 快速预览</span>
          <div class="hidden items-center gap-1 xl:flex">
            <span class="kbd-badge">Ctrl</span>
            <span class="kbd-badge">Enter</span>
            <span class="ml-1 text-[11px] whitespace-nowrap text-(--color-text-tertiary)">钉住预览</span>
          </div>
        </template>
      </header>

      <div v-show="!moyu.bossMode" class="relative min-h-0 flex-1">
        <webview
          v-for="site in openSites"
          :id="`moyu-site-${site.id}`"
          :key="site.id"
          :src="site.url"
          v-show="site.id === state.activeSiteId"
          class="absolute inset-0 h-full w-full"
          partition="moyu-sites"
          webpreferences="nodeIntegration=false, contextIsolation=true, sandbox=true"
          @dom-ready="updateAudio"
        />
        <div v-if="!openSites.length" class="flex h-full items-center justify-center text-sm text-(--color-text-tertiary)">
          从右上角“站点”选择网站开始摸鱼
        </div>
      </div>

      <div v-show="moyu.bossMode" class="flex min-h-0 flex-1 flex-col font-mono text-sm leading-6">
        <div class="flex items-center gap-2 border-b border-(--color-border-muted) px-4 py-1.5 text-[11px] text-(--color-text-tertiary)">
          <span>src &gt; utils &gt; format-duration.ts</span>
          <span class="ml-auto">TypeScript</span>
        </div>

        <div ref="previewArea" class="flex min-h-0 flex-1">
          <div class="relative w-12 shrink-0 bg-(--color-bg-elevated) text-(--color-text-tertiary)">
            <div class="absolute inset-x-0 top-0 bottom-8 overflow-hidden" aria-hidden="true">
              <div class="pt-3 pr-3 text-right" :style="{ transform: `translateY(-${scrollTop}px)` }">
                <div v-for="line in lineCount" :key="line">{{ line }}</div>
              </div>
            </div>

            <div class="absolute inset-x-0 bottom-0">
              <button
                ref="trigger"
                type="button"
                class="block h-8 w-full cursor-pointer border-t border-dashed border-(--color-border-default) text-(--color-text-tertiary) hover:bg-(--color-bg-overlay)"
                aria-label="选择预览站点"
                @pointerenter="queuePreview"
                @pointerleave="cancelHover"
                @click="sitePickerOpen = !sitePickerOpen"
              >⋯</button>
              <ul v-if="sitePickerOpen" class="absolute bottom-full left-1 z-20 max-h-72 w-60 overflow-auto rounded-md border border-(--color-border-default) bg-(--color-bg-surface) p-1 font-sans text-xs shadow-xl">
                <li v-for="site in sites" :key="site.id">
                  <button
                    class="w-full cursor-pointer rounded px-3 py-2 text-left hover:bg-(--color-bg-overlay)"
                    :class="site.id === state.previewSiteId ? 'text-(--color-accent-hover)' : 'text-(--color-text-secondary)'"
                    @click="choosePreviewSite(site.id)"
                  >{{ site.name }}</button>
                </li>
                <li class="border-t border-(--color-border-muted)">
                  <button class="w-full cursor-pointer rounded px-3 py-2 text-left text-(--color-text-secondary) hover:bg-(--color-bg-overlay)" @click="openManager">管理网站</button>
                </li>
              </ul>
            </div>
          </div>

          <div class="relative min-w-0 flex-1">
            <div
              v-if="preview.phase !== 'hidden'"
              class="absolute inset-x-0 top-0 z-10 flex items-center gap-1.5 border-b border-(--color-border-default) bg-(--color-bg-surface) px-3 text-[11px]"
              :style="{ height: `${CHROME_HEIGHT}px` }"
            >
              <span class="flex items-center gap-1.5 text-(--color-text-secondary)">
                <span
                  class="inline-block h-1.5 w-1.5 rounded-full"
                  :style="{ background: preview.phase === 'ready' ? 'var(--color-success)' : preview.phase === 'error' ? 'var(--color-error)' : 'var(--color-warning)' }"
                />
                {{ preview.phase === 'loading' ? '加载中…' : preview.phase === 'error' ? '加载失败' : previewSite?.name ?? '预览' }}
              </span>
              <span v-if="preview.pinned" class="rounded bg-(--color-accent-muted) px-1.5 py-0.5 text-(--color-accent-hover)">已钉住</span>
              <div class="ml-auto flex items-center gap-0.5">
                <button class="cursor-pointer rounded px-1.5 py-1 hover:bg-(--color-bg-overlay)" title="后退 (Alt + ←)" @click="runCommand('back')">←</button>
                <button class="cursor-pointer rounded px-1.5 py-1 hover:bg-(--color-bg-overlay)" title="前进 (Alt + →)" @click="runCommand('forward')">→</button>
                <button class="cursor-pointer rounded px-1.5 py-1 hover:bg-(--color-bg-overlay)" title="刷新 (Ctrl + R)" @click="runCommand('reload')">⟳</button>
                <button class="cursor-pointer rounded px-1.5 py-1 hover:bg-(--color-bg-overlay)" :title="preview.pinned ? '取消钉住' : '钉住预览'" @click="togglePinState">📌</button>
                <button class="cursor-pointer rounded px-1.5 py-1 hover:bg-(--color-bg-overlay)" title="全屏（Esc 退出）" @click="runCommand('fullscreen')">⛶</button>
                <button class="cursor-pointer rounded px-1.5 py-1 text-(--color-error) hover:bg-(--color-bg-overlay)" title="关闭预览 (Esc)" @click="runCommand('close')">✕</button>
              </div>
            </div>

            <div v-if="preview.phase === 'loading'" class="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 overflow-hidden bg-(--color-bg-base) px-4 py-4" :style="{ top: `${CHROME_HEIGHT}px` }" aria-hidden="true">
              <div class="skeleton h-3 w-1/3 rounded" />
              <div class="skeleton h-3 w-2/3 rounded" />
              <div class="skeleton h-3 w-1/2 rounded" />
              <div class="skeleton mt-2 h-24 w-full rounded" />
            </div>

            <div v-if="previewError || preview.phase === 'error'" class="absolute inset-x-0 bottom-0 z-10 bg-(--color-bg-base) px-4 py-4 text-xs" :style="{ top: `${CHROME_HEIGHT}px` }">
              <p role="alert" class="text-(--color-error)">{{ previewError || '站点加载失败，请检查网络后重试' }}</p>
              <button class="mt-2 text-(--color-accent-hover) hover:underline" @click="showPreview('pinned')">重试</button>
            </div>

            <textarea
              ref="editor"
              v-model="code"
              class="h-full w-full resize-none bg-transparent px-4 py-3 text-(--color-text-primary) outline-none"
              aria-label="TypeScript 代码编辑区"
              wrap="off"
              spellcheck="false"
              @scroll="scrollTop = editor?.scrollTop ?? 0"
              @keydown="handleEditorKeydown"
            />
          </div>
        </div>

        <div class="h-44 shrink-0 border-t border-(--color-border-muted) bg-(--color-bg-base)">
          <div class="flex h-8 items-center gap-4 border-b border-(--color-border-muted) px-4 text-[11px] text-(--color-text-tertiary)">
            <span>TERMINAL</span>
            <span class="border-b border-(--color-text-tertiary) py-1">bash</span>
            <span>python</span>
          </div>
          <div class="space-y-1 px-4 py-2 text-[12px] leading-5 text-(--color-text-secondary)">
            <div><span class="text-(--color-success)">user@workstation</span>:~/project$ python -m pytest tests/ -v</div>
            <div>collected 24 items</div>
            <div class="text-(--color-success)">tests/test_processor.py::test_batch PASSED [ 8%]</div>
            <div class="text-(--color-success)">tests/test_processor.py::test_report PASSED [100%]</div>
            <div class="terminal-cursor">▋</div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.skeleton {
  background: linear-gradient(90deg, var(--color-bg-elevated) 25%, var(--color-bg-overlay) 37%, var(--color-bg-elevated) 63%);
  background-size: 400% 100%;
  animation: skeleton-loading 1.4s infinite ease-in-out;
}

.terminal-cursor {
  animation: blink 1s steps(1) infinite;
}

@keyframes skeleton-loading {
  from { background-position: 100% 0; }
  to { background-position: 0 0; }
}

@keyframes blink {
  50% { opacity: 0; }
}
</style>
