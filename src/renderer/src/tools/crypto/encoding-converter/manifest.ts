import type { ToolManifest } from '@shared/types'

export const manifest: ToolManifest = {
  id: 'encoding-converter',
  name: '编码转换',
  description: 'Base64、URL、十六进制的双向编解码，纯本地处理',
  icon: '🔐',
  category: 'crypto',
  keywords: ['base64', 'url', 'hex', 'encode', 'decode', '编码', '解码', '转义'],
  component: () => import('./index.vue')
}

export default manifest
