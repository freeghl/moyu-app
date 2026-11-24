<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToolState } from '../../../utils/useToolState'

const state = useToolState('json-formatter', {
  input: '{"name":"moyu","tags":["browser","electron"],"version":1}',
  indent: 2
})

const output = ref('')
const error = ref('')
const copied = ref(false)

const stats = computed(() => {
  if (!output.value) return ''
  return `${output.value.length} 字符 · ${output.value.split('\n').length} 行`
})

function format(): void {
  try {
    const parsed: unknown = JSON.parse(state.value.input)
    output.value = JSON.stringify(parsed, null, state.value.indent)
    error.value = ''
  } catch (problem) {
    output.value = ''
    error.value = (problem as Error).message
  }
}

function minify(): void {
  try {
    const parsed: unknown = JSON.parse(state.value.input)
    output.value = JSON.stringify(parsed)
    error.value = ''
  } catch (problem) {
    output.value = ''
    error.value = (problem as Error).message
  }
}

function escapeString(): void {
  const text = output.value || state.value.input
  output.value = JSON.stringify(text)
  error.value = ''
}

async function copy(): Promise<void> {
  if (!output.value) return
  await navigator.clipboard.writeText(output.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1200)
}

function clear(): void {
  state.value.input = ''
  output.value = ''
  error.value = ''
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <header class="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-xs" style="border-color: var(--color-border-muted)">
      <button type="button" class="rounded-md px-2.5 py-1 font-medium text-white hover:opacity-90" style="background: var(--color-accent)" @click="format">
        格式化
      </button>
      <button type="button" class="rounded-md border px-2.5 py-1 hover:bg-white/[0.04]" style="border-color: var(--color-border-default); color: var(--color-text-secondary)" @click="minify">
        压缩
      </button>
      <button type="button" class="rounded-md border px-2.5 py-1 hover:bg-white/[0.04]" style="border-color: var(--color-border-default); color: var(--color-text-secondary)" @click="escapeString">
        转义为字符串
      </button>

      <div class="ml-2 flex items-center gap-1" style="color: var(--color-text-tertiary)">
        <span>缩进</span>
        <button
          v-for="width in [2, 4]"
          :key="width"
          type="button"
          class="rounded px-1.5 py-0.5 font-mono"
          :style="{
            background: state.indent === width ? 'var(--color-accent-muted)' : 'transparent',
            color: state.indent === width ? 'var(--color-accent-hover)' : 'var(--color-text-tertiary)'
          }"
          @click="state.indent = width"
        >{{ width }}</button>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <span v-if="stats" class="font-mono text-[11px]" style="color: var(--color-text-tertiary)">{{ stats }}</span>
        <button type="button" class="rounded-md border px-2.5 py-1 hover:bg-white/[0.04]" style="border-color: var(--color-border-default); color: var(--color-text-secondary)" @click="copy">
          {{ copied ? '已复制' : '复制结果' }}
        </button>
        <button type="button" class="rounded-md border px-2.5 py-1 hover:bg-white/[0.04]" style="border-color: var(--color-border-default); color: var(--color-text-tertiary)" @click="clear">
          清空
        </button>
      </div>
    </header>

    <p v-if="error" role="alert" class="border-b px-4 py-2 font-mono text-[11px]" style="border-color: var(--color-border-muted); color: var(--color-error)">
      {{ error }}
    </p>

    <div class="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
      <textarea
        v-model="state.input"
        class="h-full min-h-[240px] w-full resize-none border-b p-4 font-mono text-sm outline-none lg:border-b-0 lg:border-r"
        style="background: var(--color-bg-base); border-color: var(--color-border-muted); color: var(--color-text-primary)"
        spellcheck="false"
        placeholder="粘贴 JSON…"
        aria-label="JSON 输入"
      />
      <textarea
        :value="output"
        readonly
        class="h-full min-h-[240px] w-full resize-none p-4 font-mono text-sm outline-none"
        style="background: var(--color-bg-elevated); color: var(--color-text-secondary)"
        spellcheck="false"
        placeholder="结果会出现在这里"
        aria-label="JSON 输出"
        aria-live="polite"
      />
    </div>
  </section>
</template>
