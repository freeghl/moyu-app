<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToolState } from '../../../utils/useToolState'

interface Prompt {
  id: string
  title: string
  content: string
}

const SEED: Prompt[] = [
  {
    id: 'seed-review',
    title: '代码审查',
    content: '请以资深工程师的身份审查下面的代码，重点关注：\n1. 潜在 bug 与边界条件\n2. 可读性与命名\n3. 性能与安全\n按严重程度排序，只给出必要的问题。'
  },
  {
    id: 'seed-explain',
    title: '解释一段代码',
    content: '请逐段解释下面代码的作用，说明输入输出、关键分支和可能的坑，最后给出一句话总结。'
  },
  {
    id: 'seed-commit',
    title: '生成提交信息',
    content: '根据下面的改动生成一条符合 Conventional Commits 的提交信息，包含 type、scope 和中文正文。'
  }
]

const state = useToolState('prompt-library', {
  prompts: SEED,
  selectedId: SEED[0].id,
  query: ''
})

const copied = ref(false)

const filtered = computed(() => {
  const q = state.value.query.trim().toLowerCase()
  if (!q) return state.value.prompts
  return state.value.prompts.filter(
    (item) => item.title.toLowerCase().includes(q) || item.content.toLowerCase().includes(q)
  )
})

const selected = computed(() =>
  state.value.prompts.find((item) => item.id === state.value.selectedId) ?? null
)

/** 编辑区绑定对象：无选中时退化成空对象，避免模板里到处判空 */
const draft = computed<Prompt>(() => selected.value ?? { id: '', title: '', content: '' })

function create(): void {
  const prompt: Prompt = { id: crypto.randomUUID(), title: '新的提示词', content: '' }
  state.value.prompts = [prompt, ...state.value.prompts]
  state.value.selectedId = prompt.id
  state.value.query = ''
}

function remove(id: string): void {
  const next = state.value.prompts.filter((item) => item.id !== id)
  state.value.prompts = next
  if (state.value.selectedId === id) state.value.selectedId = next[0]?.id ?? ''
}

async function copy(): Promise<void> {
  if (!selected.value?.content) return
  await navigator.clipboard.writeText(selected.value.content)
  copied.value = true
  setTimeout(() => (copied.value = false), 1200)
}
</script>

<template>
  <section class="flex h-full min-h-0">
    <aside class="flex w-60 shrink-0 flex-col border-r" style="border-color: var(--color-border-muted); background: var(--color-bg-elevated)">
      <div class="space-y-2 border-b p-2" style="border-color: var(--color-border-muted)">
        <input
          v-model="state.query"
          class="w-full rounded-md border px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500"
          style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
          placeholder="搜索提示词…"
          aria-label="搜索提示词"
        />
        <button type="button" class="w-full cursor-pointer rounded-md px-2 py-1.5 text-xs font-medium text-white hover:opacity-90" style="background: var(--color-accent)" @click="create">
          + 新建提示词
        </button>
      </div>

      <ul class="min-h-0 flex-1 overflow-y-auto p-1.5">
        <li v-for="item in filtered" :key="item.id">
          <button
            type="button"
            class="w-full cursor-pointer truncate rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/[0.04]"
            :style="{
              background: item.id === state.selectedId ? 'var(--color-accent-muted)' : 'transparent',
              color: item.id === state.selectedId ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'
            }"
            @click="state.selectedId = item.id"
          >{{ item.title || '未命名' }}</button>
        </li>
        <li v-if="!filtered.length" class="px-2 py-6 text-center text-[11px]" style="color: var(--color-text-tertiary)">
          没有匹配的提示词
        </li>
      </ul>
    </aside>

    <div v-if="selected" class="flex min-w-0 flex-1 flex-col">
      <header class="flex items-center gap-2 border-b px-4 py-2" style="border-color: var(--color-border-muted)">
        <input
          v-model="draft.title"
          class="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 text-sm font-semibold outline-none focus:bg-white/[0.04]"
          style="color: var(--color-text-primary)"
          aria-label="提示词标题"
        />
        <button type="button" class="shrink-0 cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium text-white hover:opacity-90" style="background: var(--color-accent)" @click="copy">
          {{ copied ? '已复制' : '复制内容' }}
        </button>
        <button type="button" class="shrink-0 cursor-pointer rounded-md border px-2.5 py-1 text-xs hover:bg-white/[0.04]" style="border-color: var(--color-border-default); color: var(--color-error)" @click="remove(draft.id)">
          删除
        </button>
      </header>
      <textarea
        v-model="draft.content"
        class="min-h-0 flex-1 resize-none bg-transparent px-4 py-3 font-mono text-sm leading-6 outline-none"
        style="color: var(--color-text-primary)"
        placeholder="在这里写下提示词正文…"
        aria-label="提示词内容"
        spellcheck="false"
      />
    </div>

    <div v-else class="flex flex-1 items-center justify-center text-xs" style="color: var(--color-text-tertiary)">
      左侧新建一条提示词开始使用
    </div>
  </section>
</template>
