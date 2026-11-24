import type { ToolManifest } from '@shared/types'

export const manifest: ToolManifest = {
  id: 'demo-tool',
  name: '示例工具模板',
  description: '这是一个基础工具骨架模板，演示如何编写独立工具组件',
  icon: '⚡',
  category: 'dev',
  keywords: ['demo', 'template', '示例', '模板'],
  component: () => import('./index.vue')
}

export default manifest
