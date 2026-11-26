import type { ActivityCategory, TrackerState } from '@shared/timeCoach'

export interface CategoryMeta {
  id: ActivityCategory
  label: string
  color: string
  badgeBg: string
}

export const CATEGORY_META: Record<ActivityCategory, CategoryMeta> = {
  deep_work: {
    id: 'deep_work',
    label: '深度工作',
    color: '#6366f1',
    badgeBg: 'rgba(99, 102, 241, 0.16)'
  },
  research: {
    id: 'research',
    label: '调研文档',
    color: '#06b6d4',
    badgeBg: 'rgba(6, 182, 212, 0.16)'
  },
  communication: {
    id: 'communication',
    label: '沟通协作',
    color: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.16)'
  },
  leisure: {
    id: 'leisure',
    label: '摸鱼休息',
    color: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.16)'
  },
  other: {
    id: 'other',
    label: '其他应用',
    color: '#71717a',
    badgeBg: 'rgba(113, 113, 122, 0.16)'
  },
  private: {
    id: 'private',
    label: '隐私跳过',
    color: '#ec4899',
    badgeBg: 'rgba(236, 72, 153, 0.16)'
  }
}

export const CATEGORY_LIST: readonly CategoryMeta[] = [
  CATEGORY_META.deep_work,
  CATEGORY_META.research,
  CATEGORY_META.communication,
  CATEGORY_META.leisure,
  CATEGORY_META.other,
  CATEGORY_META.private
]

export const TRACKER_STATE_LABEL: Record<TrackerState, string> = {
  stopped: '未开启',
  active: '采集中',
  idle: '已闲置',
  paused: '已暂停',
  locked: '已锁屏',
  suspended: '已休眠',
  error: '采集异常'
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const remM = m % 60
  if (h <= 0) return `${m}m`
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`
}

export function formatClock(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatLocalDate(ts = Date.now()): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
