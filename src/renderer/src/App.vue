<script setup lang="ts">
import AppLayout from './layouts/AppLayout.vue'
import { useNavStore } from './stores'
import { onMounted } from 'vue'

const navStore = useNavStore()

onMounted(() => {
  navStore.init()
  
  // Listen for global search shortcut
  window.api?.onToggleSearch(() => {
    // Will be handled by the search component
    window.dispatchEvent(new CustomEvent('toggle-search'))
  })
})
</script>

<template>
  <AppLayout />
</template>
