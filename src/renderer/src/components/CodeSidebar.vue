<template>
  <aside
    class="flex h-full shrink-0 border-r border-(--color-border-muted)"
    style="width: 258px; background: var(--shell-bg); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px)"
  >
    <div class="flex w-11 shrink-0 flex-col items-center border-r border-(--color-border-muted) py-2 text-(--color-text-tertiary)">
      <span class="mb-3 text-(--color-text-primary)" title="资源管理器">
        <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.4" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Zm0 4.5 9 4.5 9-4.5M3 16.5l9 4.5 9-4.5" />
        </svg>
      </span>
      <span title="搜索">
        <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <circle cx="10.5" cy="10.5" r="6.5" /><path stroke-linecap="round" d="m15.5 15.5 5 5" />
        </svg>
      </span>
      <span class="mt-3" title="源代码管理">
        <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="8" r="2" />
          <path stroke-linecap="round" d="M6 7v10m0-2c0-4 12-2 12-7" />
        </svg>
      </span>
      <span class="mt-3" title="运行和调试">
        <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="m8 5 11 7-11 7V5Z" />
        </svg>
      </span>
      <span class="mt-3" title="扩展">
        <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linejoin="round" d="M5 4h6v6H5V4Zm8 0h6v6h-6V4ZM5 12h6v6H5v-6Zm8 0h6v6h-6v-6Z" />
        </svg>
      </span>
      <div class="mt-auto flex flex-col items-center gap-4">
        <span title="账户">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="3.5" /><path stroke-linecap="round" d="M5 20c.5-4 3-6 7-6s6.5 2 7 6" />
          </svg>
        </span>
        <button class="rounded p-1 hover:bg-white/[0.08] hover:text-(--color-text-primary)" title="系统设置" @click="$emit('settings')">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m9.5 3-.6 2.2-2 .9-2-.7-2.4 4 1.6 1.5v2.2l-1.6 1.5 2.4 4 2-.7 2 .9.6 2.2h5l.6-2.2 2-.9 2 .7 2.4-4-1.6-1.5v-2.2l1.6-1.5-2.4-4-2 .7-2-.9-.6-2.2h-5Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </div>

    <section class="flex min-w-0 flex-1 flex-col text-[12px] text-(--color-text-secondary)">
      <header class="flex h-10 shrink-0 items-center justify-between px-4">
        <span class="text-[10px] tracking-wide">EXPLORER</span>
        <span class="space-x-2 text-[15px] leading-none">•••</span>
      </header>

      <div class="shrink-0 border-t border-(--color-border-muted)">
        <div class="flex h-6 items-center gap-1 px-2 font-semibold text-(--color-text-primary)">
          <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
          OPEN EDITORS
        </div>
        <div class="flex h-6 items-center gap-2 bg-(--color-accent-muted) pl-8 pr-3 text-(--color-text-primary)">
          <span class="font-mono text-[10px] font-bold text-sky-400">TS</span>
          <span class="truncate">format-duration.ts</span>
          <span class="ml-auto text-(--color-text-tertiary)">×</span>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto py-1">
        <div class="flex h-6 items-center gap-1 px-2 font-semibold text-(--color-text-primary)">
          <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
          MOYU-APP
        </div>
        <div class="flex h-6 items-center gap-2 pl-5">
          <svg class="h-3.5 w-3.5 text-sky-400" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
          <svg class="h-4 w-4 text-amber-400" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>
          src
        </div>
        <div class="flex h-6 items-center gap-2 pl-9">
          <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
          <svg class="h-4 w-4 text-amber-400" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>
          utils
        </div>
        <div class="flex h-6 items-center gap-2 bg-(--color-accent-muted) pl-14 pr-3 text-(--color-text-primary)">
          <span class="font-mono text-[10px] font-bold text-sky-400">TS</span>
          format-duration.ts
        </div>
        <div class="flex h-6 items-center gap-2 pl-14">
          <span class="font-mono text-[10px] font-bold text-sky-400">TS</span>
          date.ts
        </div>
        <div class="flex h-6 items-center gap-2 pl-9">
          <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg>
          <svg class="h-4 w-4 text-amber-400" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>
          tests
        </div>
        <div class="flex h-6 items-center gap-2 pl-5">
          <span class="font-mono text-[10px] font-bold text-amber-300">{ }</span>
          package.json
        </div>
        <div class="flex h-6 items-center gap-2 pl-5">
          <span class="font-mono text-[10px] font-bold text-sky-400">TS</span>
          tsconfig.json
        </div>
        <div class="flex h-6 items-center gap-2 pl-5">
          <svg class="h-4 w-4 text-sky-400" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 4h9l5 5v11H5V4Zm9 0v5h5M8 13h8M8 17h6" /></svg>
          README.md
        </div>
        <div class="flex h-6 items-center gap-2 pl-5">
          <svg class="h-4 w-4 text-orange-400" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><circle cx="6" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="8" r="2" /><path d="M6 8v8m0-2c0-4 12-2 12-7" /></svg>
          .gitignore
        </div>
      </div>

      <div class="shrink-0 border-t border-(--color-border-muted) py-1">
        <div class="flex h-6 items-center gap-1 px-3 font-semibold text-(--color-text-primary)">
          <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg>
          OUTLINE
        </div>
        <div class="flex h-6 items-center gap-1 px-3 font-semibold text-(--color-text-primary)">
          <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg>
          TIMELINE
        </div>
      </div>
    </section>
  </aside>
</template>

<script setup lang="ts">
defineEmits<{ settings: [] }>()
</script>
