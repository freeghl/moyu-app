<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { AppSettings } from '@shared/preferences'
import { usePrefsStore } from '../stores/prefsStore'
import { useSettingsStore } from '../stores/settingsStore'

const prefs = usePrefsStore()
const backgroundSettings = useSettingsStore()

type ShortcutField = 'bossKey' | 'hideKey' | 'summonKey' | 'videoPreviousKey' | 'videoNextKey'

const version = ref('')
const dataDir = ref('')
const recordField = ref<ShortcutField | null>(null)
const shortcutError = ref('')
const shortcutSaving = ref(false)

const settings = computed(() => prefs.state.settings)
const canAdjustBackground = computed(() => backgroundSettings.hasDraftBackground && !backgroundSettings.isLoading)
const backgroundPreviewStyle = computed(() => ({
  opacity: backgroundSettings.opacity / 100,
  filter: `blur(${backgroundSettings.blur}px)`,
  transform: `scale(${1 + backgroundSettings.blur / 500})`
}))

function chooseBackground(): void {
  void backgroundSettings.selectBackground()
}

function updateBackgroundOpacity(event: Event): void {
  backgroundSettings.setOpacity(Number((event.target as HTMLInputElement).value))
}

function updateBackgroundBlur(event: Event): void {
  backgroundSettings.setBlur(Number((event.target as HTMLInputElement).value))
}

onMounted(async () => {
  version.value = (await window.api?.app.version()) ?? ''
  dataDir.value = (await window.api?.app.dataDir()) ?? ''
  window.addEventListener('keydown', handleRecordKey, true)
})

onBeforeUnmount(() => window.removeEventListener('keydown', handleRecordKey, true))

function toggle(key: 'closeToTray' | 'restoreSession'): void {
  prefs.patch({ settings: { [key]: !settings.value[key] } })
}

function formatAccelerator(accelerator: string): string {
  if (!accelerator) return '未设置'
  return accelerator.replace(/CommandOrControl/gi, 'Ctrl').replace(/\+/g, ' + ')
}

function toAccelerator(event: KeyboardEvent): string | null {
  const key = event.key
  if (['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'Dead'].includes(key)) return null

  const modifiers: string[] = []
  if (event.ctrlKey || event.metaKey) modifiers.push('CommandOrControl')
  if (event.altKey) modifiers.push('Alt')
  if (event.shiftKey) modifiers.push('Shift')

  const isFunctionKey = /^F\d{1,2}$/.test(key)
  if (!modifiers.length && !isFunctionKey) return null

  const keyAliases: Record<string, string> = {
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    ' ': 'Space'
  }
  return [...modifiers, keyAliases[key] ?? (key.length === 1 ? key.toUpperCase() : key)].join('+')
}

async function handleRecordKey(event: KeyboardEvent): Promise<void> {
  if (!recordField.value) return
  event.preventDefault()
  event.stopPropagation()

  if (event.key === 'Escape') {
    recordField.value = null
    return
  }

  const accelerator = toAccelerator(event)
  if (!accelerator) return

  const field = recordField.value
  recordField.value = null
  await apply({ [field]: accelerator })
}

async function apply(patch: Partial<Pick<AppSettings, ShortcutField>>): Promise<void> {
  const api = window.api?.shortcuts
  if (!api) return

  const next = { ...settings.value, ...patch }
  shortcutSaving.value = true
  shortcutError.value = ''
  try {
    const result = await api.apply(
      next.bossKey,
      next.hideKey,
      next.summonKey,
      next.videoPreviousKey,
      next.videoNextKey
    )
    if (!result.ok) {
      shortcutError.value = result.error ?? '快捷键注册失败'
      return
    }
    prefs.patch({ settings: patch })
  } catch {
    shortcutError.value = '快捷键注册失败，请重试'
  } finally {
    shortcutSaving.value = false
  }
}

async function clearShortcut(field: ShortcutField): Promise<void> {
  await apply({ [field]: '' })
}

function openDataDir(): void {
  void window.api?.app.openDataDir()
}

function hideToTray(): void {
  void window.api?.app.hideToTray()
}
</script>

<template>
  <section class="h-full overflow-y-auto px-8 py-8 select-text">
    <div class="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 class="text-lg font-semibold" style="color: var(--color-text-primary)">设置</h1>
        <p class="mt-1 text-xs" style="color: var(--color-text-tertiary)">
          通用设置与快捷键会自动保存；背景图片调整后需点击“确定并应用”。
        </p>
      </header>

      <section class="glass-panel rounded-xl border" style="background: var(--panel-bg); border-color: var(--panel-border)" aria-labelledby="background-heading">
        <div class="flex items-center gap-3 border-b px-4 py-3" style="border-color: var(--panel-border)">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style="background: var(--control-bg); color: var(--color-text-secondary)">
            <svg class="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 0 0 2.25-2.25V5.25a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v13.5a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <h2 id="background-heading" class="text-xs font-semibold" style="color: var(--color-text-primary)">应用背景</h2>
            <p class="mt-1 text-[11px]" style="color: var(--color-text-tertiary)">选择本地图片，调整透明度与虚化，预览后应用到整个应用。</p>
          </div>
          <span class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px]" style="background: var(--control-bg); border-color: var(--panel-border); color: var(--color-text-secondary)">
            <span class="h-1.5 w-1.5 rounded-full" :style="{ background: backgroundSettings.hasBackground ? 'var(--color-success)' : 'var(--color-text-disabled)' }"></span>
            {{ backgroundSettings.hasBackground ? '背景已启用' : '默认背景' }}
          </span>
        </div>

        <div class="grid gap-4 p-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div class="relative aspect-[16/10] overflow-hidden rounded-xl border" style="background: var(--color-bg-base); border-color: var(--panel-border)">
            <template v-if="backgroundSettings.hasDraftBackground">
              <div class="absolute inset-0" :style="backgroundPreviewStyle">
                <img :src="backgroundSettings.imageUrl" alt="应用背景预览" class="h-full w-full object-cover">
              </div>
              <span class="absolute inset-x-2 bottom-2 truncate rounded-md px-2 py-1 text-[10px] backdrop-blur-md" style="background: rgba(9, 10, 13, 0.72); color: var(--color-text-secondary)">
                {{ backgroundSettings.originalName || backgroundSettings.fileName }}
              </span>
            </template>
            <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl" style="background: var(--control-bg); color: var(--color-text-tertiary)">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5V18a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-1.5M7.5 7.5 12 3l4.5 4.5M12 3v12m6.75 3.75H5.25" />
                </svg>
              </div>
              <p class="text-[11px] font-medium" style="color: var(--color-text-secondary)">尚未选择背景图片</p>
              <p class="text-[10px] leading-relaxed" style="color: var(--color-text-tertiary)">支持 PNG、JPG、WEBP、GIF、BMP，最大 20 MB</p>
            </div>
            <div v-if="backgroundSettings.isLoading" class="absolute inset-0 flex items-center justify-center" style="background: rgba(9, 10, 13, 0.58)" role="status" aria-label="正在处理背景图片">
              <span class="h-6 w-6 animate-spin rounded-full border-2" style="border-color: var(--color-bg-muted); border-top-color: var(--color-accent)"></span>
            </div>
          </div>

          <div class="min-w-0 space-y-3">
            <p v-if="backgroundSettings.error" class="rounded-lg border px-3 py-2 text-[11px]" style="background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.28); color: #fca5a5" role="alert">
              {{ backgroundSettings.error }}
            </p>
            <p v-if="backgroundSettings.isDirty" class="rounded-lg border px-3 py-2 text-[11px]" style="background: var(--color-accent-muted); border-color: var(--panel-border); color: var(--color-text-secondary)" role="status">
              当前为预览效果，点击“确定并应用”后才会应用到整个应用。
            </p>

            <div class="flex flex-wrap gap-2">
              <button type="button" class="cursor-pointer rounded-md px-3 py-1.5 text-[11px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45" style="background: var(--color-accent)" :disabled="backgroundSettings.isLoading" @click="chooseBackground">
                {{ backgroundSettings.hasDraftBackground ? '更换本地图片' : '选择本地图片' }}
              </button>
              <button type="button" class="cursor-pointer rounded-md px-3 py-1.5 text-[11px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45" style="background: var(--color-accent)" :disabled="!backgroundSettings.isDirty || backgroundSettings.isLoading" @click="backgroundSettings.applyBackground()">
                确定并应用
              </button>
              <button v-if="backgroundSettings.isDirty" type="button" class="cursor-pointer rounded-md border px-3 py-1.5 text-[11px] transition hover:bg-white/[0.04] disabled:opacity-45" style="background: var(--control-bg); border-color: var(--panel-border); color: var(--color-text-secondary)" :disabled="backgroundSettings.isLoading" @click="backgroundSettings.cancelChanges()">
                取消更改
              </button>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <div class="mb-2 flex items-center justify-between text-[11px]">
                  <label for="settings-background-opacity" style="color: var(--color-text-secondary)">透明度</label>
                  <output for="settings-background-opacity" class="rounded px-1.5 py-0.5 font-mono" style="background: var(--control-bg); color: var(--color-text-primary)">{{ backgroundSettings.opacity }}%</output>
                </div>
                <input id="settings-background-opacity" type="range" min="0" max="100" step="1" class="h-1.5 w-full cursor-pointer accent-indigo-500 disabled:cursor-not-allowed disabled:opacity-40" :value="backgroundSettings.opacity" :disabled="!canAdjustBackground" @input="updateBackgroundOpacity">
                <div class="mt-1 flex justify-between text-[10px]" style="color: var(--color-text-tertiary)"><span>透明</span><span>不透明</span></div>
              </div>
              <div>
                <div class="mb-2 flex items-center justify-between text-[11px]">
                  <label for="settings-background-blur" style="color: var(--color-text-secondary)">背景虚化</label>
                  <output for="settings-background-blur" class="rounded px-1.5 py-0.5 font-mono" style="background: var(--control-bg); color: var(--color-text-primary)">{{ backgroundSettings.blur }}px</output>
                </div>
                <input id="settings-background-blur" type="range" min="0" max="40" step="1" class="h-1.5 w-full cursor-pointer accent-indigo-500 disabled:cursor-not-allowed disabled:opacity-40" :value="backgroundSettings.blur" :disabled="!canAdjustBackground" @input="updateBackgroundBlur">
                <div class="mt-1 flex justify-between text-[10px]" style="color: var(--color-text-tertiary)"><span>清晰</span><span>高度虚化</span></div>
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <button type="button" class="cursor-pointer rounded-md border px-2.5 py-1.5 text-[11px] transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-45" style="background: var(--control-bg); border-color: var(--panel-border); color: var(--color-text-secondary)" :disabled="!canAdjustBackground" @click="backgroundSettings.resetParameters()">恢复默认参数</button>
              <button type="button" class="cursor-pointer rounded-md border px-2.5 py-1.5 text-[11px] transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-45" style="background: transparent; border-color: var(--panel-border); color: #fca5a5" :disabled="(!backgroundSettings.hasBackground && !backgroundSettings.hasDraftBackground) || backgroundSettings.isLoading" @click="backgroundSettings.removeBackground()">移除背景</button>
            </div>
            <p class="text-[10px] leading-relaxed" style="color: var(--color-text-tertiary)">图片仅保存在本机应用数据目录，不会上传；应用后重启仍会恢复。</p>
          </div>
        </div>
      </section>

      <!-- 通用 -->
      <div class="glass-panel rounded-xl border" style="background: var(--panel-bg); border-color: var(--panel-border)">
        <h2 class="border-b px-4 py-2.5 text-xs font-semibold" style="border-color: var(--color-border-muted); color: var(--color-text-secondary)">
          通用
        </h2>
        <div class="divide-y" style="--tw-divide-opacity: 1">
          <div class="flex items-center justify-between gap-6 px-4 py-3">
            <div class="min-w-0">
              <p class="text-xs font-medium" style="color: var(--color-text-primary)">关闭窗口时最小化到托盘</p>
              <p class="mt-1 text-[11px]" style="color: var(--color-text-tertiary)">
                开启后点关闭只是收进托盘，可从托盘或快速隐藏随时唤回
              </p>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="settings.closeToTray"
              class="relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors"
              :style="{ background: settings.closeToTray ? 'var(--color-accent)' : 'var(--color-bg-muted)' }"
              @click="toggle('closeToTray')"
            >
              <span
                class="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
                :style="{ left: settings.closeToTray ? '18px' : '2px' }"
              ></span>
            </button>
          </div>

          <div class="flex items-center justify-between gap-6 px-4 py-3">
            <div class="min-w-0">
              <p class="text-xs font-medium" style="color: var(--color-text-primary)">启动时恢复上次会话</p>
              <p class="mt-1 text-[11px]" style="color: var(--color-text-tertiary)">
                重新打开上次的标签页，并回到当时的分类
              </p>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="settings.restoreSession"
              class="relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors"
              :style="{ background: settings.restoreSession ? 'var(--color-accent)' : 'var(--color-bg-muted)' }"
              @click="toggle('restoreSession')"
            >
              <span
                class="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
                :style="{ left: settings.restoreSession ? '18px' : '2px' }"
              ></span>
            </button>
          </div>
        </div>
      </div>

      <!-- 快捷键 -->
      <div class="glass-panel rounded-xl border" style="background: var(--panel-bg); border-color: var(--panel-border)">
        <h2 class="border-b px-4 py-2.5 text-xs font-semibold" style="border-color: var(--color-border-muted); color: var(--color-text-secondary)">
          全局快捷键
        </h2>
        <div class="space-y-3 px-4 py-4">
          <div
            v-for="item in [
              { field: 'bossKey' as const, title: '老板键', desc: '全局生效，切换假代码界面 / 摸鱼界面' },
              { field: 'hideKey' as const, title: '快速隐藏', desc: '全局生效，按下立即隐藏窗口，再按一次恢复' },
              { field: 'summonKey' as const, title: '全局唤起', desc: '在任何程序里唤起窗口并打开命令面板' },
              { field: 'videoPreviousKey' as const, title: '视频上一条', desc: '桌面悬停视频播放时生效，切换到上一条视频' },
              { field: 'videoNextKey' as const, title: '视频下一条', desc: '桌面悬停视频播放时生效，切换到下一条视频' }
            ]"
            :key="item.field"
            class="flex items-center justify-between gap-6"
          >
            <div class="min-w-0">
              <p class="text-xs font-medium" style="color: var(--color-text-primary)">{{ item.title }}</p>
              <p class="mt-1 text-[11px]" style="color: var(--color-text-tertiary)">{{ item.desc }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <button
                type="button"
                class="min-w-[168px] cursor-pointer rounded-md border px-3 py-1.5 font-mono text-[11px] transition-colors"
                :style="{
                  background: recordField === item.field ? 'var(--color-accent-muted)' : 'var(--control-bg)',
                  borderColor: recordField === item.field ? 'var(--color-accent)' : 'var(--panel-border)',
                  color: recordField === item.field ? 'var(--color-accent-hover)' : 'var(--color-text-secondary)'
                }"
                :disabled="shortcutSaving"
                @click="recordField = recordField === item.field ? null : item.field"
              >
                {{ recordField === item.field ? '请按下组合键…' : formatAccelerator(settings[item.field]) }}
              </button>
              <button
                v-if="settings[item.field]"
                type="button"
                class="cursor-pointer text-[11px] hover:underline"
                style="color: var(--color-text-tertiary)"
                :disabled="shortcutSaving"
                @click="clearShortcut(item.field)"
              >
                清除
              </button>
            </div>
          </div>
          <p v-if="shortcutError" role="alert" class="text-[11px]" style="color: var(--color-error)">
            {{ shortcutError }}
          </p>
          <p class="text-[11px]" style="color: var(--color-text-tertiary)">
            提示：组合键至少包含 Ctrl / Alt / Shift 之一，Esc 可取消录制。
          </p>
        </div>
      </div>

      <!-- 数据 -->
      <div class="glass-panel rounded-xl border" style="background: var(--panel-bg); border-color: var(--panel-border)">
        <h2 class="border-b px-4 py-2.5 text-xs font-semibold" style="border-color: var(--color-border-muted); color: var(--color-text-secondary)">
          数据与版本
        </h2>
        <div class="space-y-3 px-4 py-4 text-xs">
          <div class="flex items-center justify-between gap-4">
            <span style="color: var(--color-text-tertiary)">数据目录</span>
            <span class="truncate font-mono text-[11px]" :title="dataDir" style="color: var(--color-text-secondary)">
              {{ dataDir || '读取中…' }}
            </span>
          </div>
          <div class="flex items-center justify-between gap-4">
            <span style="color: var(--color-text-tertiary)">应用版本</span>
            <span class="font-mono text-[11px]" style="color: var(--color-text-secondary)">v{{ version || '—' }}</span>
          </div>
          <div class="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              class="cursor-pointer rounded-md border px-3 py-1.5 text-[11px] transition-colors hover:bg-white/[0.04]"
              style="border-color: var(--color-border-default); color: var(--color-text-secondary)"
              @click="openDataDir()"
            >
              打开数据目录
            </button>
            <button
              type="button"
              class="cursor-pointer rounded-md border px-3 py-1.5 text-[11px] transition-colors hover:bg-white/[0.04]"
              style="border-color: var(--color-border-default); color: var(--color-text-secondary)"
              @click="hideToTray()"
            >
              现在隐藏到托盘
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
