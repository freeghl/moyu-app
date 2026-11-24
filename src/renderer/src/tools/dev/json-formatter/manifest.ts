import type { ToolManifest } from '@shared/types'

export const manifest: ToolManifest = {
  id: 'json-formatter',
  name: 'JSON 格式化',
  description: '格式化、压缩并校验 JSON，高亮定位语法错误',
  icon: '{}',
  category: 'dev',
  keywords: ['json', 'format', 'pretty', 'minify', '格式化', '压缩', '校验'],
  component: () => import('./index.vue')
}

export default manifest
