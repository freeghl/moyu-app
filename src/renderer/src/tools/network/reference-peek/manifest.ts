import type { ToolManifest } from '@shared/types'

export const manifest: ToolManifest = {
  id: 'reference-peek',
  name: '文档速查',
  description: '在编辑器旁快速查阅参考文档，鼠标移开自动收起',
  icon: '📖',
  category: 'network',
  keywords: ['文档', '参考', '速查', 'docs', 'mdn', '预览'],
  component: () => import('./index.vue')
}

export default manifest
