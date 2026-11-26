import type { ToolManifest } from '@shared/types'

export const manifest: ToolManifest = {
  id: 'desktop-hover-video',
  name: '桌面悬停视频',
  description: '鼠标移到桌面图标热区时随机播放 TikTok、抖音或哔哩哔哩推荐视频',
  icon: 'VID',
  category: 'system',
  keywords: ['桌面', '悬停', '视频', '图标', '播放', '浮窗'],
  component: () => import('./index.vue')
}

export default manifest
