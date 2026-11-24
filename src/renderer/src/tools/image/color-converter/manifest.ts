import type { ToolManifest } from '@shared/types'

export const manifest: ToolManifest = {
  id: 'color-converter',
  name: '颜色转换',
  description: 'HEX / RGB / HSL 互转，附带取色与明暗色阶',
  icon: '🎨',
  category: 'image',
  keywords: ['color', 'hex', 'rgb', 'hsl', '取色', '配色', '颜色'],
  component: () => import('./index.vue')
}

export default manifest
