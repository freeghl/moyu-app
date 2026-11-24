import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useMoyuStore = defineStore('moyu', () => {
  const bossMode = ref(true)

  function toggleBossMode(): void {
    bossMode.value = !bossMode.value
  }

  return { bossMode, toggleBossMode }
})
