<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { moyuSites, type PreviewRect } from '@shared/moyuPreview'
import { useTabStore } from '../../../stores'

const tabStore = useTabStore()
const active = computed(() => tabStore.activeTab?.toolId === 'moyu-resources')
const site = ref<(typeof moyuSites)[number]>(moyuSites[0])
const editor = ref<HTMLTextAreaElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const picker = ref<HTMLElement | null>(null)
const pickerOpen = ref(false)
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
  if (event.pointerType === 'touch' || event.pointerType === 'pen' || !active.value || pickerOpen.value) return
  cancelHover()
  hoverTimer = setTimeout(() => {
    hoverTimer = undefined
    if (!active.value || pickerOpen.value || !editor.value || !trigger.value) return
    const bounds = rect(trigger.value)
    const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    if (!trigger.value.contains(hit)) return

    const { url } = site.value
    loadFailed.value = false
    void window.api?.moyuPreview.show({
      url,
      editor: rect(editor.value),
      trigger: bounds
    }).catch(() => {
      if (site.value.url === url) loadFailed.value = true
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

function chooseSite(nextSite: (typeof moyuSites)[number]): void {
  site.value = nextSite
  pickerOpen.value = false
  loadFailed.value = false
  trigger.value?.focus()
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
</script>

<template>
  <section class="flex h-full min-h-0 flex-col bg-(--color-bg-base)" @keydown.esc="hidePreview">
    <header class="flex h-9 shrink-0 items-center justify-between border-b border-(--color-border-muted) px-4 text-xs text-(--color-text-secondary)">
      <span class="font-mono">format-duration.ts</span>
      <span v-if="loadFailed" role="status">站点加载失败，可重新悬停重试。</span>
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
          <ul v-if="pickerOpen" class="absolute bottom-full left-1 z-10 w-52 rounded-md border border-(--color-border-default) bg-(--color-bg-surface) p-1 text-xs shadow-xl">
            <li v-for="item in moyuSites" :key="item.url">
              <button
                type="button"
                class="w-full cursor-pointer rounded px-2 py-1.5 text-left hover:bg-(--color-bg-overlay) focus-visible:bg-(--color-bg-overlay)"
                :class="item.url === site.url ? 'text-(--color-accent-hover)' : 'text-(--color-text-secondary)'"
                :aria-pressed="item.url === site.url"
                @click="chooseSite(item)"
              >{{ item.name }}</button>
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
