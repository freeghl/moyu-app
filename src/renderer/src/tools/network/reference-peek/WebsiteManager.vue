<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Site, SiteChange, SiteChangeResult } from '@shared/sitePreview'

const props = defineProps<{
  sites: Site[] | null
  loading: boolean
  saveChange: (change: SiteChange) => Promise<SiteChangeResult>
}>()
const emit = defineEmits<{
  close: []
  reload: []
}>()

const title = ref<HTMLElement | null>(null)
const nameInput = ref<HTMLInputElement | null>(null)
const editingId = ref<string>()
const deletingId = ref<string>()
const name = ref('')
const url = ref('')
const saving = ref(false)
const error = ref('')

onMounted(() => title.value?.focus())

function clearForm(): void {
  editingId.value = undefined
  name.value = ''
  url.value = ''
  error.value = ''
}

function edit(site: Site): void {
  deletingId.value = undefined
  editingId.value = site.id
  name.value = site.name
  url.value = site.url
  error.value = ''
  nameInput.value?.focus()
}

function confirmRemoval(site: Site): void {
  deletingId.value = site.id
  error.value = ''
}

async function changeSite(change: SiteChange): Promise<void> {
  if (saving.value) return

  saving.value = true
  error.value = ''
  try {
    const result = await props.saveChange(change)
    if ('error' in result) {
      error.value = result.error
      return
    }

    if (change.type === 'save' || change.id === editingId.value) clearForm()
    deletingId.value = undefined
  } catch {
    error.value = '保存失败，请重试。'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="min-h-0 flex-1 overflow-auto p-6 text-sm text-(--color-text-primary)" aria-labelledby="website-manager-title" @keydown.esc.stop="emit('close')">
    <div class="mx-auto max-w-3xl space-y-5">
      <header class="flex items-center justify-between gap-4">
        <h2 id="website-manager-title" ref="title" tabindex="-1" class="text-lg font-semibold outline-none">管理网站</h2>
        <button type="button" class="rounded-md border border-(--color-border-default) px-3 py-1.5 hover:bg-(--color-bg-surface)" @click="emit('close')">返回编辑区</button>
      </header>

      <div v-if="loading" role="status" class="text-(--color-text-secondary)">正在读取网站列表…</div>
      <div v-else-if="sites === null" class="flex items-center gap-3">
        <p role="alert" class="text-(--color-error)">无法读取网站列表。</p>
        <button type="button" class="text-(--color-accent-hover) hover:underline" @click="emit('reload')">重试</button>
      </div>

      <template v-else>
        <form class="space-y-3 rounded-lg border border-(--color-border-default) bg-(--color-bg-elevated) p-4" @submit.prevent="changeSite({ type: 'save', id: editingId, name, url })">
          <h3 class="font-medium">{{ editingId ? '编辑网站' : '新增网站' }}</h3>
          <div class="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <label class="grid gap-1.5 text-xs text-(--color-text-secondary)">
              网站名称
              <input ref="nameInput" v-model="name" required :disabled="saving" class="rounded-md border border-(--color-border-default) bg-(--color-bg-base) px-3 py-2 text-sm text-(--color-text-primary)" />
            </label>
            <label class="grid gap-1.5 text-xs text-(--color-text-secondary)">
              HTTPS 网址
              <input v-model="url" required type="url" placeholder="https://example.com/" :disabled="saving" class="rounded-md border border-(--color-border-default) bg-(--color-bg-base) px-3 py-2 text-sm text-(--color-text-primary)" />
            </label>
          </div>
          <div class="flex items-center gap-3">
            <button type="submit" :disabled="saving" class="rounded-md bg-(--color-accent) px-3 py-1.5 text-white hover:bg-(--color-accent-hover) disabled:opacity-50">保存网站</button>
            <button v-if="editingId" type="button" :disabled="saving" class="text-(--color-text-secondary) hover:underline" @click="clearForm">取消编辑</button>
          </div>
        </form>

        <p v-if="error" role="alert" class="text-sm text-(--color-error)">{{ error }}</p>
        <p v-if="sites.length === 0" class="text-(--color-text-secondary)">暂无网站，可在上方添加。</p>
        <ul v-else class="divide-y divide-(--color-border-default) rounded-lg border border-(--color-border-default)">
          <li v-for="site in sites" :key="site.id" class="flex items-center justify-between gap-4 px-4 py-3">
            <div class="min-w-0">
              <p class="break-all font-medium">{{ site.name }}</p>
              <p class="break-all text-xs text-(--color-text-secondary)">{{ site.url }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-3 text-xs">
              <template v-if="deletingId === site.id">
                <button type="button" :disabled="saving" class="text-(--color-error) hover:underline" @click="changeSite({ type: 'remove', id: site.id })">确认删除</button>
                <button type="button" :disabled="saving" class="text-(--color-text-secondary) hover:underline" @click="deletingId = undefined">取消</button>
              </template>
              <template v-else>
                <button type="button" :disabled="saving" class="text-(--color-accent-hover) hover:underline" @click="edit(site)">编辑</button>
                <button type="button" :disabled="saving" class="text-(--color-text-secondary) hover:underline" @click="confirmRemoval(site)">删除</button>
              </template>
            </div>
          </li>
        </ul>
      </template>
    </div>
  </section>
</template>
