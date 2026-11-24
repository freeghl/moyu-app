import type { ToolManifest } from '@shared/types'

export const manifest: ToolManifest = {
  id: 'moyu-resources',
  name: '摸鱼浏览器',
  description: '伪装成代码编辑器的多站点浏览器，支持老板键与悬停预览',
  icon: '🐟',
  category: 'network',
  keywords: ['摸鱼', '浏览器', '站点', '伪装', '老板键', '预览'],
  component: () => import('./index.vue')
}

export default manifest
