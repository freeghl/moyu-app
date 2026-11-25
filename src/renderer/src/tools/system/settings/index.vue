<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '../../../stores'

const settingsStore = useSettingsStore()
const canAdjust = computed(() => settingsStore.hasDraftBackground && !settingsStore.isLoading)
const previewStyle = computed(() => ({
  opacity: settingsStore.opacity / 100,
  filter: `blur(${settingsStore.blur}px)`,
  transform: `scale(${1 + settingsStore.blur / 500})`
}))

async function chooseImage(): Promise<void> {
  await settingsStore.selectBackground()
}

function updateOpacity(event: Event): void {
  settingsStore.setOpacity(Number((event.target as HTMLInputElement).value))
}

function updateBlur(event: Event): void {
  settingsStore.setBlur(Number((event.target as HTMLInputElement).value))
}
</script>

<template>
  <div class="h-full overflow-y-auto px-6 py-7 lg:px-8">
    <div class="max-w-5xl mx-auto">
      <header class="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight" style="color: var(--color-text-primary)">
            系统设置
          </h1>
          <p class="mt-1.5 text-base" style="color: var(--color-text-tertiary)">
            管理应用外观与工作区背景。
          </p>
        </div>
        <span
          class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
          style="background: var(--color-bg-elevated); border-color: var(--color-border-muted); color: var(--color-text-secondary)"
        >
          <span
            class="h-2 w-2 rounded-full"
            :style="{ background: settingsStore.hasBackground ? 'var(--color-success)' : 'var(--color-text-disabled)' }"
          ></span>
          {{ settingsStore.hasBackground ? '背景已启用' : '使用默认背景' }}
        </span>
      </header>

      <section
        class="overflow-hidden rounded-2xl border"
        style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)"
        aria-labelledby="background-heading"
      >
        <div class="flex items-center gap-3 border-b p-5" style="border-color: var(--color-border-muted)">
          <div
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style="background: var(--color-bg-overlay); color: var(--color-text-secondary)"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 0 0 2.25-2.25V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
          </div>
          <div>
            <h2 id="background-heading" class="text-base font-semibold" style="color: var(--color-text-primary)">
              应用背景
            </h2>
            <p class="mt-0.5 text-sm" style="color: var(--color-text-tertiary)">
              选择本地图片，并调整它在工作区中的显示效果。
            </p>
          </div>
        </div>

        <div class="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <div
            class="group relative aspect-[16/10] overflow-hidden rounded-xl border"
            style="background: var(--color-bg-base); border-color: var(--color-border-default)"
          >
            <template v-if="settingsStore.hasDraftBackground">
              <div class="absolute inset-0" :style="previewStyle">
                <img
                  :src="settingsStore.imageUrl"
                  alt="当前应用背景预览"
                  class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                >
              </div>
              <button
                class="settings-action absolute right-3 top-3 inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium backdrop-blur-md"
                style="background: rgba(9, 10, 13, 0.78); border-color: rgba(255, 255, 255, 0.16); color: var(--color-text-primary)"
                :disabled="settingsStore.isLoading"
                @click="chooseImage"
              >
                更换图片
              </button>
            </template>

            <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <div
                class="flex h-14 w-14 items-center justify-center rounded-2xl"
                style="background: var(--color-bg-overlay); color: var(--color-text-tertiary)"
              >
                <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5V18a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-1.5M7.5 7.5 12 3l4.5 4.5M12 3v12m6.75 3.75H5.25" />
                </svg>
              </div>
              <div>
                <p class="text-base font-medium" style="color: var(--color-text-secondary)">
                  {{ settingsStore.hasBackground ? '应用后将移除背景图片' : '尚未选择背景图片' }}
                </p>
                <p class="mt-1 text-sm" style="color: var(--color-text-tertiary)">支持 PNG、JPG、WEBP、GIF 和 BMP，最大 20 MB。</p>
              </div>
            </div>

            <div
              v-if="settingsStore.isLoading"
              class="absolute inset-0 flex items-center justify-center"
              style="background: rgba(9, 10, 13, 0.58)"
              role="status"
              aria-label="正在处理背景图片"
            >
              <span class="h-7 w-7 animate-spin rounded-full border-2" style="border-color: var(--color-bg-muted); border-top-color: var(--color-accent)"></span>
            </div>
          </div>

          <div class="flex flex-col gap-5">
            <p v-if="settingsStore.error" class="rounded-lg border px-3 py-2.5 text-sm" style="background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.28); color: #fca5a5" role="alert">
              {{ settingsStore.error }}
            </p>

            <p v-if="settingsStore.isDirty" class="rounded-lg border px-3 py-2.5 text-sm" style="background: var(--color-accent-muted); border-color: var(--color-border-default); color: var(--color-text-secondary)" role="status">
              当前为预览效果，点击“确定并应用”后才会应用到整个应用。
            </p>

            <button
              class="settings-action inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold"
              style="background: var(--color-accent); color: white"
              :disabled="settingsStore.isLoading"
              @click="chooseImage"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {{ settingsStore.hasDraftBackground ? '更换本地图片' : '选择本地图片' }}
            </button>

            <div class="flex gap-2">
              <button
                class="settings-action inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 text-sm font-semibold"
                style="background: var(--color-accent); color: white"
                :disabled="!settingsStore.isDirty || settingsStore.isLoading"
                @click="settingsStore.applyBackground()"
              >
                确定并应用
              </button>
              <button
                v-if="settingsStore.isDirty"
                class="settings-action inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-medium"
                style="background: var(--color-bg-overlay); border-color: var(--color-border-default); color: var(--color-text-secondary)"
                :disabled="settingsStore.isLoading"
                @click="settingsStore.cancelChanges()"
              >
                取消更改
              </button>
            </div>

            <div class="space-y-4">
              <div>
                <div class="mb-1 flex items-center justify-between gap-3">
                  <label for="background-opacity" class="text-sm font-medium" style="color: var(--color-text-secondary)">透明度</label>
                  <output for="background-opacity" class="min-w-12 rounded-md px-2 py-1 text-center font-mono text-sm" style="background: var(--color-bg-overlay); color: var(--color-text-primary)">
                    {{ settingsStore.opacity }}%
                  </output>
                </div>
                <div class="flex h-11 items-center">
                  <input
                    id="background-opacity"
                    class="settings-range"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    :value="settingsStore.opacity"
                    :style="{ '--range-progress': `${settingsStore.opacity}%` }"
                    :disabled="!canAdjust"
                    @input="updateOpacity"
                  >
                </div>
                <div class="flex justify-between text-xs" style="color: var(--color-text-tertiary)">
                  <span>完全透明</span>
                  <span>完全不透明</span>
                </div>
              </div>

              <div>
                <div class="mb-1 flex items-center justify-between gap-3">
                  <label for="background-blur" class="text-sm font-medium" style="color: var(--color-text-secondary)">背景虚化</label>
                  <output for="background-blur" class="min-w-12 rounded-md px-2 py-1 text-center font-mono text-sm" style="background: var(--color-bg-overlay); color: var(--color-text-primary)">
                    {{ settingsStore.blur }}px
                  </output>
                </div>
                <div class="flex h-11 items-center">
                  <input
                    id="background-blur"
                    class="settings-range"
                    type="range"
                    min="0"
                    max="40"
                    step="1"
                    :value="settingsStore.blur"
                    :style="{ '--range-progress': `${(settingsStore.blur / 40) * 100}%` }"
                    :disabled="!canAdjust"
                    @input="updateBlur"
                  >
                </div>
                <div class="flex justify-between text-xs" style="color: var(--color-text-tertiary)">
                  <span>清晰</span>
                  <span>高度虚化</span>
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-2 sm:flex-row">
              <button
                class="settings-action inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border px-3 text-sm font-medium"
                style="background: var(--color-bg-overlay); border-color: var(--color-border-default); color: var(--color-text-secondary)"
                :disabled="!canAdjust"
                @click="settingsStore.resetParameters"
              >
                恢复默认参数
              </button>
              <button
                class="settings-action inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border px-3 text-sm font-medium"
                style="background: transparent; border-color: var(--color-border-default); color: #fca5a5"
                :disabled="(!settingsStore.hasBackground && !settingsStore.hasDraftBackground) || settingsStore.isLoading"
                @click="settingsStore.removeBackground"
              >
                移除背景
              </button>
            </div>

            <p class="text-sm leading-relaxed" style="color: var(--color-text-tertiary)">
              图片仅保存在当前设备的应用数据目录中，不会上传。点击“确定并应用”后保存设置，重启应用后仍会恢复。
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings-action {
  transition: transform 150ms ease, background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}

.settings-action:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.08);
}

.settings-action:active:not(:disabled) {
  transform: translateY(0) scale(0.99);
}

.settings-action:focus-visible {
  outline: 2px solid var(--color-accent-hover);
  outline-offset: 2px;
}

.settings-action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.settings-range {
  width: 100%;
  height: 24px;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

.settings-range::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 9999px;
  background: linear-gradient(
    to right,
    var(--color-accent) 0%,
    var(--color-accent) var(--range-progress),
    var(--color-bg-muted) var(--range-progress),
    var(--color-bg-muted) 100%
  );
}

.settings-range::-webkit-slider-thumb {
  width: 16px;
  height: 16px;
  margin-top: -6px;
  appearance: none;
  border: 2px solid var(--color-bg-elevated);
  border-radius: 9999px;
  background: var(--color-accent-hover);
  box-shadow: 0 0 0 1px var(--color-accent);
}

.settings-range:focus-visible {
  outline: none;
}

.settings-range:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 4px var(--color-accent-muted);
}

.settings-range:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

@media (prefers-reduced-motion: reduce) {
  .settings-action,
  .group img {
    transition: none;
  }

  .settings-action:hover:not(:disabled),
  .settings-action:active:not(:disabled),
  .group:hover img {
    transform: none;
  }
}
</style>
