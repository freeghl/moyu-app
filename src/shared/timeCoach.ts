export type ActivityCategory =
  | 'deep_work'
  | 'research'
  | 'communication'
  | 'leisure'
  | 'other'
  | 'private'

export type TrackerState =
  | 'stopped'
  | 'active'
  | 'idle'
  | 'paused'
  | 'locked'
  | 'suspended'
  | 'error'

export interface ActivitySegment {
  id: string
  date: string
  state: TrackerState
  category?: ActivityCategory
  appKey?: string
  appName?: string
  windowTitle?: string
  startAt: number
  endAt: number
  durationSec: number
}

export interface ActivityRule {
  id: string
  name: string
  enabled: boolean
  priority: number
  source: 'builtin' | 'user'
  appPattern?: string
  titleKeyword?: string
  isPrivacy?: boolean
  category: ActivityCategory
  idleThresholdSec?: number
}

export interface ActivityRuleInput {
  id?: string
  name: string
  enabled?: boolean
  priority?: number
  appPattern?: string
  titleKeyword?: string
  isPrivacy?: boolean
  category: ActivityCategory
  idleThresholdSec?: number
}

export interface FocusSession {
  id: string
  startAt: number
  endAt: number
  activeDurationSec: number
  interruptionCount: number
  segmentIds: string[]
}

export interface TopAppStat {
  appName: string
  category: ActivityCategory
  durationSec: number
}

export interface DailyTimeSummary {
  date: string
  totalActiveSec: number
  totalWorkSec: number
  focusSec: number
  longestFocusSec: number
  leisureSec: number
  idleSec: number
  switchCount: number
  categoryTotals: Record<ActivityCategory, number>
  topApps: TopAppStat[]
  focusSessions: FocusSession[]
  segments: ActivitySegment[]
}

export interface TrendPoint {
  date: string
  totalWorkSec: number
  focusSec: number
  longestFocusSec: number
  leisureSec: number
  switchCount: number
  categoryTotals: Record<ActivityCategory, number>
}

export interface TimeCoachSettings {
  enabled: boolean
  pollIntervalSec: number
  idleThresholdSec: number
  passiveIdleThresholdSec: number
  saveWindowTitle: boolean
  retentionDays: number
  breakReminderEnabled: boolean
  breakReminderMinutes: number
}

export type TimeCoachSettingsPatch = Partial<TimeCoachSettings>

export interface TimeCoachStatus {
  state: TrackerState
  enabled: boolean
  currentAppName?: string
  currentCategory?: ActivityCategory
  currentSegmentStartAt?: number
  todayWorkSec: number
  todayFocusSec: number
  todayLeisureSec?: number
  currentFocusStreakSec: number
  breakReminderDue: boolean
  lastError?: string
}

export interface TimeCoachDailyNote {
  date: string
  energyScore?: number
  goal?: string
  note?: string
  aiReview?: string
  aiReport?: string
  updatedAt: number
}

export interface ReclassifyRequest {
  date: string
  segmentId?: string
  appName?: string
  category: ActivityCategory
  createRule?: boolean
}

export interface TimeCoachAPI {
  getStatus: () => Promise<TimeCoachStatus>
  start: () => Promise<TimeCoachStatus>
  pause: () => Promise<TimeCoachStatus>
  resume: () => Promise<TimeCoachStatus>
  stop: () => Promise<TimeCoachStatus>
  dismissBreakReminder: () => Promise<TimeCoachStatus>
  getDailySummary: (date?: string) => Promise<DailyTimeSummary>
  getTrends: (days?: number) => Promise<TrendPoint[]>
  getSettings: () => Promise<TimeCoachSettings>
  updateSettings: (patch: TimeCoachSettingsPatch) => Promise<TimeCoachSettings>
  listRules: () => Promise<ActivityRule[]>
  saveRule: (input: ActivityRuleInput) => Promise<ActivityRule[]>
  deleteRule: (id: string) => Promise<ActivityRule[]>
  reclassify: (req: ReclassifyRequest) => Promise<DailyTimeSummary>
  getDailyNote: (date?: string) => Promise<TimeCoachDailyNote>
  saveDailyNote: (note: Partial<TimeCoachDailyNote> & { date: string }) => Promise<TimeCoachDailyNote>
  buildAiDigest: (date?: string, days?: number) => Promise<string>
  clearHistory: (date?: string) => Promise<void>
  onStatusChanged: (callback: (status: TimeCoachStatus) => void) => () => void
}
