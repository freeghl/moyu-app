import type { ToolManifest } from '@shared/types'

export const manifest: ToolManifest = {
  id: 'time-coach',
  name: '工作统计',
  description: '本地静默记录工作与休息时间分布、专注心流分析与 AI 每日复盘/日报生成',
  icon: 'TIME',
  category: 'system',
  keywords: ['工作', '工作统计', '时间', '账单', '专注', '心流', 'AI', '教练', '复盘', '日报', '统计', '防过劳'],
  component: () => import('./index.vue')
}

export default manifest
