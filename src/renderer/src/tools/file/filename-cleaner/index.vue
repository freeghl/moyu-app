<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToolState } from '../../../utils/useToolState'

const state = useToolState('filename-cleaner', {
  input: 'My File Name (1).txt\n报告 2026/01 终稿.pdf\n  logo  Final .png',
  spaceToUnderscore: true,
  stripIllegal: true,
  collapseUnderscore: true,
  lowercase: false,
  numbering: false,
  find: '',
  replace: ''
})

const copied = ref(false)

const rules = computed(() => [
  { key: 'stripIllegal' as const, label: '去掉非法字符（\\ / : * ? " < > |）' },
  { key: 'spaceToUnderscore' as const, label: '空格转下划线' },
  { key: 'collapseUnderscore' as const, label: '合并重复下划线并去掉首尾' },
  { key: 'lowercase' as const, label: '转为小写' },
  { key: 'numbering' as const, label: '添加序号前缀（01_、02_…）' }
])

const sourceLines = computed(() => state.value.input.split('\n').map((line) => line.trim()).filter(Boolean))

const results = computed(() => {
  const find = state.value.find
  return sourceLines.value.map((line, index) => {
    let name = line
    if (state.value.stripIllegal) name = name.replace(/[\\/:*?"<>|]/g, '-')
    if (find) name = name.split(find).join(state.value.replace)
    if (state.value.spaceToUnderscore) name = name.replace(/\s+/g, '_')
    if (state.value.collapseUnderscore) name = name.replace(/_+/g, '_').replace(/^_|_$/g, '')
    if (state.value.lowercase) name = name.toLowerCase()
    if (state.value.numbering) name = `${String(index + 1).padStart(2, '0')}_${name}`
    return { before: line, after: name }
  })
})

const changedCount = computed(() => results.value.filter((item) => item.before !== item.after).length)

function toggle(key: (typeof rules.value)[number]['key']): void {
  state.value[key] = !state.value[key]
}

async function copyAll(): Promise<void> {
  if (!results.value.length) return
  await navigator.clipboard.writeText(results.value.map((item) => item.after).join('\n'))
  copied.value = true
  setTimeout(() => (copied.value = false), 1200)
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <header class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5 text-[11px]" style="border-color: var(--color-border-muted)">
      <label v-for="rule in rules" :key="rule.key" class="flex cursor-pointer items-center gap-1.5">
        <input type="checkbox" :checked="state[rule.key]" class="accent-indigo-500" @change="toggle(rule.key)" />
        <span style="color: var(--color-text-secondary)">{{ rule.label }}</span>
      </label>

      <div class="flex items-center gap-1.5">
        <input
          v-model="state.find"
          class="w-24 rounded border px-2 py-1 outline-none focus:border-indigo-500"
          style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
          placeholder="查找"
          aria-label="查找文本"
        />
        <input
          v-model="state.replace"
          class="w-24 rounded border px-2 py-1 outline-none focus:border-indigo-500"
          style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
          placeholder="替换为"
          aria-label="替换文本"
        />
      </div>

      <div class="ml-auto flex items-center gap-2">
        <span class="font-mono" style="color: var(--color-text-tertiary)">{{ results.length }} 行 · 改动 {{ changedCount }}</span>
        <button type="button" class="cursor-pointer rounded-md px-2.5 py-1 text-white hover:opacity-90" style="background: var(--color-accent)" @click="copyAll">
          {{ copied ? '已复制' : '复制结果' }}
        </button>
      </div>
    </header>

    <div class="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
      <div class="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r" style="border-color: var(--color-border-muted)">
        <span class="px-4 pt-3 text-[11px] uppercase tracking-wider" style="color: var(--color-text-tertiary)">原始文件名（每行一个）</span>
        <textarea
          v-model="state.input"
          class="min-h-[220px] flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-6 outline-none"
          style="color: var(--color-text-primary)"
          spellcheck="false"
          aria-label="原始文件名"
        />
      </div>

      <div class="flex min-h-0 flex-col" style="background: var(--color-bg-elevated)">
        <span class="px-4 pt-3 text-[11px] uppercase tracking-wider" style="color: var(--color-text-tertiary)">整理后</span>
        <div class="min-h-0 flex-1 overflow-y-auto p-4 font-mono text-sm leading-6" aria-live="polite">
          <p v-if="!results.length" class="text-xs" style="color: var(--color-text-tertiary)">左侧输入文件名后实时预览</p>
          <div v-for="(item, index) in results" :key="index" class="flex items-baseline gap-2">
            <span class="w-6 shrink-0 text-right text-[11px]" style="color: var(--color-text-tertiary)">{{ index + 1 }}</span>
            <span class="truncate" :style="{ color: item.before === item.after ? 'var(--color-text-secondary)' : 'var(--color-success)' }">{{ item.after }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
