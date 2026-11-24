<script setup lang="ts">
import TitleBar from '../components/TitleBar.vue'
import Sidebar from '../components/Sidebar.vue'
import TabBar from '../components/TabBar.vue'
import WorkArea from '../components/WorkArea.vue'
import StatusBar from '../components/StatusBar.vue'
import SearchPalette from '../components/SearchPalette.vue'
import { useNavStore } from '../stores'

const navStore = useNavStore()
</script>

<template>
  <div class="flex flex-col h-screen w-screen overflow-hidden select-none" style="background: var(--color-bg-base)">
    <!-- Title Bar -->
    <TitleBar />

    <!-- Main Body -->
    <div class="flex flex-1 min-h-0">
      <!-- Sidebar -->
      <Sidebar />

      <!-- Content Area -->
      <div class="flex flex-col flex-1 min-w-0">
        <!-- Tab Bar -->
        <TabBar />

        <!-- Work Area -->
        <WorkArea />
      </div>
    </div>

    <!-- Status Bar -->
    <StatusBar />

    <!-- Search Palette (overlay) -->
    <SearchPalette />
  </div>
</template>
