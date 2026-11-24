import type { ToolManifest } from '@shared/types'

export const manifest: ToolManifest = {
  id: 'prompt-library',
  name: '提示词库',
  description: '沉淀常用的 AI 提示词，一键复制到任意模型',
  icon: '✨',
  category: 'ai',
  keywords: ['prompt', 'ai', '模板', '提示词', '指令', '收藏'],
  component: () => import('./index.vue')
}

export default manifest
