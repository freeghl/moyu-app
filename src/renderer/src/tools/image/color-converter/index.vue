<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToolState } from '../../../utils/useToolState'

const state = useToolState('color-converter', { hex: '#6366F1' })
const copiedKey = ref('')

function normalizeHex(value: string): string | null {
  const raw = value.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw.split('').map((char) => char + char).join('').toUpperCase()}`
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toUpperCase()}`
  return null
}

const hex = computed(() => normalizeHex(state.value.hex))

const rgb = computed(() => {
  if (!hex.value) return null
  return {
    r: Number.parseInt(hex.value.slice(1, 3), 16),
    g: Number.parseInt(hex.value.slice(3, 5), 16),
    b: Number.parseInt(hex.value.slice(5, 7), 16)
  }
})

const hsl = computed(() => {
  if (!rgb.value) return null
  const r = rgb.value.r / 255
  const g = rgb.value.g / 255
  const b = rgb.value.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  const delta = max - min

  if (!delta) return { h: 0, s: 0, l: Math.round(lightness * 100) }

  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let hue = 0
  if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) / 6
  else if (max === g) hue = ((b - r) / delta + 2) / 6
  else hue = ((r - g) / delta + 4) / 6

  return {
    h: Math.round(hue * 360),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100)
  }
})

const rows = computed(() => {
  if (!rgb.value || !hsl.value || !hex.value) return []
  return [
    { key: 'hex', label: 'HEX', value: hex.value },
    { key: 'rgb', label: 'RGB', value: `rgb(${rgb.value.r}, ${rgb.value.g}, ${rgb.value.b})` },
    { key: 'rgba', label: 'RGBA', value: `rgba(${rgb.value.r}, ${rgb.value.g}, ${rgb.value.b}, 1)` },
    { key: 'hsl', label: 'HSL', value: `hsl(${hsl.value.h}, ${hsl.value.s}%, ${hsl.value.l}%)` }
  ]
})

const shades = computed(() => {
  if (!rgb.value) return []
  return [-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6].map((ratio) => {
    const mix = (channel: number): number =>
      Math.round(ratio >= 0 ? channel + (255 - channel) * ratio : channel * (1 + ratio))
    const r = mix(rgb.value!.r)
    const g = mix(rgb.value!.g)
    const b = mix(rgb.value!.b)
    const value = `#${[r, g, b].map((item) => item.toString(16).padStart(2, '0')).join('').toUpperCase()}`
    return { value, background: `rgb(${r}, ${g}, ${b})` }
  })
})

async function copy(key: string, value: string): Promise<void> {
  await navigator.clipboard.writeText(value)
  copiedKey.value = key
  setTimeout(() => (copiedKey.value = ''), 1200)
}

function pick(event: Event): void {
  state.value.hex = (event.target as HTMLInputElement).value.toUpperCase()
}
</script>

<template>
  <section class="h-full overflow-y-auto px-6 py-6">
    <div class="mx-auto max-w-3xl space-y-5">
      <div class="rounded-xl border p-5" style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)">
        <div class="flex items-center gap-4">
          <div
            class="h-20 w-20 shrink-0 rounded-xl border shadow-inner"
            :style="{ background: hex ?? 'transparent', borderColor: 'var(--color-border-default)' }"
          ></div>

          <div class="min-w-0 flex-1 space-y-2">
            <label class="block text-[11px] uppercase tracking-wider" style="color: var(--color-text-tertiary)">输入颜色</label>
            <div class="flex items-center gap-2">
              <input
                v-model="state.hex"
                class="w-40 rounded-md border px-3 py-1.5 font-mono text-sm outline-none focus:border-indigo-500"
                style="background: var(--color-bg-base); border-color: var(--color-border-default); color: var(--color-text-primary)"
                spellcheck="false"
                aria-label="颜色值"
              />
              <input type="color" :value="hex ?? '#000000'" class="h-9 w-12 cursor-pointer rounded-md border bg-transparent" style="border-color: var(--color-border-default)" aria-label="取色器" @input="pick" />
              <span v-if="!hex" class="text-[11px]" style="color: var(--color-error)">请输入 3 位或 6 位 HEX</span>
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-xl border" style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)">
        <button
          v-for="row in rows"
          :key="row.key"
          type="button"
          class="flex w-full cursor-pointer items-center justify-between gap-4 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.03]"
          style="border-color: var(--color-border-muted)"
          @click="copy(row.key, row.value)"
        >
          <span class="w-16 text-[11px] uppercase tracking-wider" style="color: var(--color-text-tertiary)">{{ row.label }}</span>
          <span class="flex-1 font-mono text-sm" style="color: var(--color-text-primary)">{{ row.value }}</span>
          <span class="text-[11px]" style="color: var(--color-text-tertiary)">{{ copiedKey === row.key ? '已复制' : '点击复制' }}</span>
        </button>
      </div>

      <div class="rounded-xl border p-4" style="background: var(--color-bg-elevated); border-color: var(--color-border-muted)">
        <p class="mb-3 text-[11px] uppercase tracking-wider" style="color: var(--color-text-tertiary)">明暗色阶</p>
        <div class="flex overflow-hidden rounded-lg">
          <button
            v-for="shade in shades"
            :key="shade.value"
            type="button"
            class="h-14 flex-1 transition-transform hover:scale-y-110"
            :style="{ background: shade.background }"
            :title="shade.value"
            :aria-label="shade.value"
            @click="state.hex = shade.value"
          ></button>
        </div>
      </div>
    </div>
  </section>
</template>
