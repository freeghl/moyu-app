import type { ToolManifest } from '@shared/types'

export const manifest: ToolManifest = {
  id: 'system-monitor',
  name: '系统监控',
  description: '查看本机硬件配置、资源占用与进程性能',
  icon: 'SYS',
  category: 'system',
  keywords: ['系统', '监控', 'CPU', '内存', '磁盘', '网络', '进程', '硬件'],
  component: () => import('./index.vue')
}

export default manifest
