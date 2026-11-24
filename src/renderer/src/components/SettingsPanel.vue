<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { AppSettings } from '@shared/preferences'
import { usePrefsStore } from '../stores/prefsStore'

const prefs = usePrefsStore()

const version = ref('')
const dataDir = ref('')
const recordField = ref<'bossKey' | 'hideKey' | 'summonKey' | null>(null)
const shortcutError = ref('')
const shortcutSaving = ref(false)

const settings = computed(() => prefs.state.settings)

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

  return [...modifiers, key.length === 1 ? key.toUpperCase() : key].join('+')
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

async function apply(patch: Partial<Pick<AppSettings, 'bossKey' | 'hideKey' | 'summonKey'>>): Promise<void> {
  const api = window.api?.shortcuts
  if (!api) return

  const next = { ...settings.value, ...patch }
  shortcutSaving.value = true
  shortcutError.value = ''
  try {
    const result = await api.apply(next.bossKey, next.hideKey, next.summonKey)
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

async function clearShortcut(field: 'bossKey' | 'hideKey' | 'summonKey'): Promise<void> {
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
          改动会立即生效并自动保存，不需要重启应用。
        </p>
      </header>

      <!-- 通用 -->
      <div class="rounded-xl border" style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)">
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
      <div class="rounded-xl border" style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)">
        <h2 class="border-b px-4 py-2.5 text-xs font-semibold" style="border-color: var(--color-border-muted); color: var(--color-text-secondary)">
          全局快捷键
        </h2>
        <div class="space-y-3 px-4 py-4">
          <div
            v-for="item in [
              { field: 'bossKey' as const, title: '老板键', desc: '全局生效，切换假代码界面 / 摸鱼界面' },
              { field: 'hideKey' as const, title: '快速隐藏', desc: '全局生效，按下立即隐藏窗口，再按一次恢复' },
              { field: 'summonKey' as const, title: '全局唤起', desc: '在任何程序里唤起窗口并打开命令面板' }
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
                  background: recordField === item.field ? 'var(--color-accent-muted)' : 'var(--color-bg-base)',
                  borderColor: recordField === item.field ? 'var(--color-accent)' : 'var(--color-border-default)',
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
      <div class="rounded-xl border" style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)">
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
