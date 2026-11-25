import type { ToolManifest } from '@shared/types'

export const manifest: ToolManifest = {
  id: 'settings',
  name: '系统设置',
  description: '调整应用背景图片、透明度与虚化效果',
  icon: '设',
  category: 'system',
  keywords: ['settings', 'background', '设置', '背景', '壁纸', '透明度', '虚化'],
  component: () => import('./index.vue')
}

export default manifest
