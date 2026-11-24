<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { MoyuSite, MoyuSiteChange, MoyuSiteChangeResult, PreviewRect } from '@shared/moyuPreview'
import { useTabStore } from '../../../stores'
import WebsiteManager from './WebsiteManager.vue'

const tabStore = useTabStore()
const active = computed(() => tabStore.activeTab?.toolId === 'moyu-resources')
const sites = ref<MoyuSite[] | null>(null)
const loadingSites = ref(false)
const selectedId = ref<string>()
const editor = ref<HTMLTextAreaElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const picker = ref<HTMLElement | null>(null)
const pickerOpen = ref(false)
const managerOpen = ref(false)
const loadFailed = ref(false)
const scrollTop = ref(0)
const code = ref(`export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
}

formatDuration(90)
`)
const lineCount = computed(() => code.value.split('\n').length)
let hoverTimer: ReturnType<typeof setTimeout> | undefined

function rect(element: HTMLElement): PreviewRect {
  const { x, y, width, height } = element.getBoundingClientRect()
  return { x, y, width, height }
}

function cancelHover(): void {
  clearTimeout(hoverTimer)
  hoverTimer = undefined
}

function queuePreview(event: PointerEvent): void {
  if (event.pointerType === 'touch' || event.pointerType === 'pen' || !active.value || pickerOpen.value || managerOpen.value || !selectedId.value) return
  cancelHover()
  hoverTimer = setTimeout(() => {
    hoverTimer = undefined
    const siteId = selectedId.value
    if (!active.value || pickerOpen.value || managerOpen.value || !siteId || !editor.value || !trigger.value) return
    const bounds = rect(trigger.value)
    const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    if (!trigger.value.contains(hit)) return

    loadFailed.value = false
    void window.api?.moyuPreview.show({
      siteId,
      editor: rect(editor.value),
      trigger: bounds
    }).catch(() => {
      if (selectedId.value === siteId) loadFailed.value = true
    })
  }, 300)
}

function hidePreview(): void {
  cancelHover()
  void window.api?.moyuPreview.hide()
}

function togglePicker(): void {
  hidePreview()
  pickerOpen.value = !pickerOpen.value
}

function chooseSite(id: string): void {
  selectedId.value = id
  pickerOpen.value = false
  loadFailed.value = false
  trigger.value?.focus()
}

function updateSites(updated: MoyuSite[], newSelection?: string): void {
  sites.value = updated
  const preferred = newSelection ?? selectedId.value
  selectedId.value = updated.find((site) => site.id === preferred)?.id ?? updated[0]?.id
  loadFailed.value = false
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

watch(active, (isActive) => {
  if (isActive) return
  pickerOpen.value = false
  hidePreview()
}, { flush: 'sync' })

onBeforeUnmount(hidePreview)
onMounted(loadSites)
</script>

<template>
  <section class="flex h-full min-h-0 flex-col bg-(--color-bg-base)" @keydown.esc="hidePreview">
    <WebsiteManager v-if="managerOpen" :sites="sites" :loading="loadingSites" :save-change="saveChange" @reload="loadSites" @close="closeManager" />

    <header v-show="!managerOpen" class="flex h-9 shrink-0 items-center justify-between border-b border-(--color-border-muted) px-4 text-xs text-(--color-text-secondary)">
      <span class="font-mono">format-duration.ts</span>
      <span v-if="loadFailed" role="status">站点加载失败，可重新悬停重试。</span>
    </header>

    <div v-show="!managerOpen" class="flex min-h-0 flex-1 font-mono text-sm leading-6">
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
          <ul v-if="pickerOpen" class="absolute bottom-full left-1 z-10 max-h-[60vh] w-52 overflow-auto rounded-md border border-(--color-border-default) bg-(--color-bg-surface) p-1 text-xs shadow-xl">
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

      <textarea
        ref="editor"
        v-model="code"
        class="min-h-0 min-w-0 flex-1 resize-none px-4 py-3 text-(--color-text-primary) outline-none"
        aria-label="TypeScript 代码编辑区"
        wrap="off"
        spellcheck="false"
        @scroll="scrollTop = editor?.scrollTop ?? 0"
        @pointerdown="pickerOpen = false"
      />
    </div>
  </section>
</template>
