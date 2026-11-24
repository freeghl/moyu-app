import type { ToolManifest } from '@shared/types'

export const manifest: ToolManifest = {
  id: 'filename-cleaner',
  name: '文件名整理',
  description: '批量清洗文件名：去非法字符、空格转下划线、加序号',
  icon: '📄',
  category: 'file',
  keywords: ['filename', 'rename', 'batch', '文件名', '重命名', '批量'],
  component: () => import('./index.vue')
}

export default manifest
