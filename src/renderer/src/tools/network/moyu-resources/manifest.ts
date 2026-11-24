import type { ToolManifest } from '@shared/types'

export const manifest: ToolManifest = {
  id: 'moyu-resources',
  name: '摸鱼资源',
  description: '小游戏、电台、播客和随手可逛的网站',
  icon: '🐟',
  category: 'network',
  keywords: ['休闲', '游戏', '电台', '播客', '博物馆', '天文'],
  component: () => import('./index.vue')
}

export default manifest
