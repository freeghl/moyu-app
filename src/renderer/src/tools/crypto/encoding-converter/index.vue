<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToolState } from '../../../utils/useToolState'

type Method = 'base64' | 'url' | 'hex'

const METHODS: { id: Method; label: string }[] = [
  { id: 'base64', label: 'Base64' },
  { id: 'url', label: 'URL 编码' },
  { id: 'hex', label: '十六进制' }
]

const state = useToolState('encoding-converter', {
  input: 'DevBox 编码测试',
  method: 'base64' as Method,
  decode: false
})

const copied = ref(false)

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(value: string): Uint8Array {
  if (!/^[0-9a-f]*$/i.test(value) || value.length % 2 !== 0) throw new Error('invalid hex')
  const bytes = new Uint8Array(value.length / 2)
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

const result = computed<{ value: string; error: string }>(() => {
  const input = state.value.input
  if (!input) return { value: '', error: '' }

  try {
    if (state.value.method === 'base64') {
      return {
        value: state.value.decode
          ? new TextDecoder().decode(base64ToBytes(input.trim()))
          : bytesToBase64(new TextEncoder().encode(input)),
        error: ''
      }
    }
    if (state.value.method === 'url') {
      return {
        value: state.value.decode ? decodeURIComponent(input) : encodeURIComponent(input),
        error: ''
      }
    }
    return {
      value: state.value.decode
        ? new TextDecoder().decode(hexToBytes(input.replace(/\s+/g, '')))
        : bytesToHex(new TextEncoder().encode(input)),
      error: ''
    }
  } catch {
    const label = METHODS.find((method) => method.id === state.value.method)?.label ?? ''
    return { value: '', error: `无法${state.value.decode ? '解码' : '编码'}：输入不是合法的 ${label} 内容` }
  }
})

async function copy(): Promise<void> {
  if (!result.value.value) return
  await navigator.clipboard.writeText(result.value.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1200)
}

function swap(): void {
  if (!result.value.value) return
  state.value.input = result.value.value
  state.value.decode = !state.value.decode
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <header class="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-xs" style="border-color: var(--color-border-muted)">
      <div class="flex items-center gap-1 rounded-lg p-0.5" style="background: var(--color-bg-muted)">
        <button
          v-for="method in METHODS"
          :key="method.id"
          type="button"
          class="rounded-md px-2.5 py-1 transition-colors"
          :style="{
            background: state.method === method.id ? 'var(--color-bg-surface)' : 'transparent',
            color: state.method === method.id ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'
          }"
          @click="state.method = method.id"
        >{{ method.label }}</button>
      </div>

      <div class="flex items-center gap-1 rounded-lg p-0.5" style="background: var(--color-bg-muted)">
        <button
          type="button"
          class="rounded-md px-2.5 py-1"
          :style="{
            background: !state.decode ? 'var(--color-bg-surface)' : 'transparent',
            color: !state.decode ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'
          }"
          @click="state.decode = false"
        >编码</button>
        <button
          type="button"
          class="rounded-md px-2.5 py-1"
          :style="{
            background: state.decode ? 'var(--color-bg-surface)' : 'transparent',
            color: state.decode ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'
          }"
          @click="state.decode = true"
        >解码</button>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <button type="button" class="rounded-md border px-2.5 py-1 hover:bg-white/[0.04]" style="border-color: var(--color-border-default); color: var(--color-text-secondary)" @click="swap">
          交换
        </button>
        <button type="button" class="rounded-md px-2.5 py-1 font-medium text-white hover:opacity-90" style="background: var(--color-accent)" @click="copy">
          {{ copied ? '已复制' : '复制结果' }}
        </button>
      </div>
    </header>

    <p v-if="result.error" role="alert" class="border-b px-4 py-2 text-[11px]" style="border-color: var(--color-border-muted); color: var(--color-error)">
      {{ result.error }}
    </p>

    <div class="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
      <div class="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r" style="border-color: var(--color-border-muted)">
        <span class="px-4 pt-3 text-[11px] uppercase tracking-wider" style="color: var(--color-text-tertiary)">{{ state.decode ? '待解码内容' : '原文' }}</span>
        <textarea
          v-model="state.input"
          class="min-h-[200px] flex-1 resize-none bg-transparent p-4 font-mono text-sm outline-none"
          style="color: var(--color-text-primary)"
          spellcheck="false"
          aria-label="输入"
        />
      </div>
      <div class="flex min-h-0 flex-col" style="background: var(--color-bg-elevated)">
        <span class="px-4 pt-3 text-[11px] uppercase tracking-wider" style="color: var(--color-text-tertiary)">{{ state.decode ? '解码结果' : '编码结果' }}</span>
        <textarea
          :value="result.value"
          readonly
          class="min-h-[200px] flex-1 resize-none bg-transparent p-4 font-mono text-sm outline-none"
          style="color: var(--color-text-secondary)"
          spellcheck="false"
          aria-label="输出"
          aria-live="polite"
        />
      </div>
    </div>
  </section>
</template>
