<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
const textInput = ref('')
</script>

<template>
  <div class="h-full flex flex-col p-6 gap-6 overflow-auto">
    <!-- Header info -->
    <div class="flex items-center justify-between pb-4 border-b" style="border-color: var(--color-border-muted)">
      <div>
        <h2 class="text-lg font-semibold" style="color: var(--color-text-primary)">示例工具模板</h2>
        <p class="text-xs mt-1" style="color: var(--color-text-tertiary)">
          独立工具组件运行在独立作用域内，切换标签页时操作状态将被自动保留。
        </p>
      </div>
      <span class="text-xs px-2.5 py-1 rounded-full font-medium" style="background: var(--color-accent-muted); color: var(--color-accent-hover)">
        开发工具
      </span>
    </div>

    <!-- State retention test card -->
    <div class="glass-panel rounded-xl border p-5 max-w-xl space-y-4" style="background: var(--panel-bg); border-color: var(--panel-border)">
      <h3 class="text-sm font-medium" style="color: var(--color-text-primary)">状态保持验证</h3>
      <p class="text-xs" style="color: var(--color-text-tertiary)">
        在下方输入内容或增加计数，切换到其他页面或标签后再切换回来，状态不会丢失。
      </p>

      <div class="flex items-center gap-3">
        <button
          class="px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style="background: var(--color-accent); color: white;"
          @click="count++"
        >
          点击计数: {{ count }}
        </button>
        <button
          class="px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/5 border"
          style="background: var(--control-bg); border-color: var(--color-border-default); color: var(--color-text-secondary)"
          @click="count = 0"
        >
          重置
        </button>
      </div>

      <div>
        <label class="text-xs font-medium block mb-1.5" style="color: var(--color-text-secondary)">文本输入持久化测试：</label>
        <input
          v-model="textInput"
          class="w-full px-3 py-2 rounded-lg text-xs outline-none border transition-colors focus:border-indigo-500"
          style="background: var(--control-bg); border-color: var(--color-border-default); color: var(--color-text-primary)"
          placeholder="在此输入任意内容测试状态保持..."
        />
      </div>
    </div>
  </div>
</template>
