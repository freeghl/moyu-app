import { randomUUID } from 'node:crypto'
import { powerMonitor } from 'electron'
import type {
  ActivityCategory,
  ActivitySegment,
  DailyTimeSummary,
  ReclassifyRequest,
  TimeCoachSettings,
  TimeCoachSettingsPatch,
  TimeCoachStatus,
  TrackerState,
  TrendPoint
} from '@shared/timeCoach'
import { createActivityProvider } from './providers/windowsForegroundProvider'
import type { ActivityProvider } from './providers/types'
import { activityRuleService } from './activityRuleService'
import { computeDailySummary, summaryToTrendPoint } from './activityStatsService'
import {
  DEFAULT_TIME_COACH_SETTINGS,
  formatLocalDate,
  getRecentDates,
  timeCoachStore
} from './timeCoachStore'

const FLUSH_INTERVAL_MS = 60_000

class ActivityTrackerService {
  private provider: ActivityProvider = createActivityProvider()
  private settings: TimeCoachSettings = { ...DEFAULT_TIME_COACH_SETTINGS }
  private state: TrackerState = 'stopped'
  private todayDate = formatLocalDate()
  private todaySegments: ActivitySegment[] = []
  private currentSegment: ActivitySegment | null = null
  private currentIdleThresholdSec = 180
  private lastError: string | undefined
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private isPolling = false
  private dirty = false
  private breakDismissedAt = 0
  private listeners = new Set<(status: TimeCoachStatus) => void>()
  private initialized = false

  async init(): Promise<void> {
    if (this.initialized) return
    this.initialized = true
    this.settings = await timeCoachStore.getSettings()
    this.todayDate = formatLocalDate()
    this.todaySegments = await timeCoachStore.getSegments(this.todayDate)
    await timeCoachStore.cleanupExpired(this.settings.retentionDays)

    powerMonitor.on('lock-screen', () => {
      if (this.state === 'active' || this.state === 'idle') {
        this.closeCurrentSegment(Date.now())
        this.state = 'locked'
        this.notifyListeners()
      }
    })

    powerMonitor.on('unlock-screen', () => {
      if (this.state === 'locked' && this.settings.enabled) {
        this.state = 'active'
        this.scheduleNextPoll(500)
        this.notifyListeners()
      }
    })

    powerMonitor.on('suspend', () => {
      if (this.state === 'active' || this.state === 'idle') {
        this.closeCurrentSegment(Date.now())
        this.state = 'suspended'
        void this.flushIfDirty()
        this.notifyListeners()
      }
    })

    powerMonitor.on('resume', () => {
      if (this.state === 'suspended' && this.settings.enabled) {
        this.state = 'active'
        this.scheduleNextPoll(1000)
        this.notifyListeners()
      }
    })

    if (this.settings.enabled) {
      await this.start()
    }
  }

  subscribe(listener: (status: TimeCoachStatus) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners(): void {
    const status = this.getStatus()
    for (const listener of this.listeners) {
      try {
        listener(status)
      } catch {
        // ignore listener error
      }
    }
  }

  getStatus(): TimeCoachStatus {
    const summary = computeDailySummary(this.todayDate, this.getMergedSegmentsForToday())
    const currentStreakSec = this.computeCurrentFocusStreakSec()
    const breakThresholdSec = this.settings.breakReminderMinutes * 60
    const recentlyDismissed = Date.now() - this.breakDismissedAt < 15 * 60_000
    const breakReminderDue =
      this.settings.breakReminderEnabled &&
      this.state === 'active' &&
      !recentlyDismissed &&
      currentStreakSec >= breakThresholdSec

    return {
      state: this.state,
      enabled: this.settings.enabled,
      currentAppName:
        this.currentSegment?.category === 'private' ? '隐私应用' : this.currentSegment?.appName,
      currentCategory: this.currentSegment?.category,
      currentSegmentStartAt: this.currentSegment?.startAt,
      todayWorkSec: summary.totalWorkSec,
      todayFocusSec: summary.focusSec,
      currentFocusStreakSec: currentStreakSec,
      breakReminderDue,
      lastError: this.lastError
    }
  }

  private computeCurrentFocusStreakSec(): number {
    if (!this.currentSegment || this.currentSegment.state !== 'active') return 0
    if (
      this.currentSegment.category !== 'deep_work' &&
      this.currentSegment.category !== 'research'
    ) {
      return 0
    }

    const segments = this.getMergedSegmentsForToday().sort((a, b) => a.startAt - b.startAt)
    let streak = 0
    let nextStart = Number.MAX_SAFE_INTEGER

    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i]
      if (
        seg.state === 'active' &&
        (seg.category === 'deep_work' || seg.category === 'research') &&
        (nextStart === Number.MAX_SAFE_INTEGER || nextStart - seg.endAt <= 60_000)
      ) {
        streak += seg.durationSec
        nextStart = seg.startAt
      } else if (nextStart - seg.endAt > 300_000) {
        break
      } else {
        break
      }
    }
    return streak
  }

  private getMergedSegmentsForToday(): ActivitySegment[] {
    if (!this.currentSegment) return this.todaySegments
    const now = Date.now()
    const liveEnd = Math.max(this.currentSegment.startAt, now)
    const liveSeg: ActivitySegment = {
      ...this.currentSegment,
      endAt: liveEnd,
      durationSec: Math.round((liveEnd - this.currentSegment.startAt) / 1000)
    }
    return [...this.todaySegments, liveSeg]
  }

  async start(): Promise<TimeCoachStatus> {
    this.settings = await timeCoachStore.patchSettings({ enabled: true })
    this.state = 'active'
    this.lastError = undefined
    this.ensureFlushTimer()
    this.scheduleNextPoll(100)
    this.notifyListeners()
    return this.getStatus()
  }

  async pause(): Promise<TimeCoachStatus> {
    this.clearPollTimer()
    this.closeCurrentSegment(Date.now())
    this.state = 'paused'
    await this.flushIfDirty()
    this.notifyListeners()
    return this.getStatus()
  }

  async resume(): Promise<TimeCoachStatus> {
    if (!this.settings.enabled) {
      return this.start()
    }
    this.state = 'active'
    this.lastError = undefined
    this.ensureFlushTimer()
    this.scheduleNextPoll(100)
    this.notifyListeners()
    return this.getStatus()
  }

  async stop(): Promise<TimeCoachStatus> {
    this.clearPollTimer()
    this.clearFlushTimer()
    this.closeCurrentSegment(Date.now())
    this.settings = await timeCoachStore.patchSettings({ enabled: false })
    this.state = 'stopped'
    await this.flushIfDirty()
    this.notifyListeners()
    return this.getStatus()
  }

  dismissBreakReminder(): TimeCoachStatus {
    this.breakDismissedAt = Date.now()
    const status = this.getStatus()
    this.notifyListeners()
    return status
  }

  private ensureFlushTimer(): void {
    if (this.flushTimer) return
    this.flushTimer = setInterval(() => {
      void this.flushIfDirty()
    }, FLUSH_INTERVAL_MS)
  }

  private clearFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
  }

  private clearPollTimer(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
  }

  private scheduleNextPoll(delayMs = this.settings.pollIntervalSec * 1000): void {
    this.clearPollTimer()
    if (this.state !== 'active' && this.state !== 'idle') return
    this.pollTimer = setTimeout(() => {
      void this.pollOnce()
    }, delayMs)
  }

  private async ensureDateRollover(now: number): Promise<void> {
    const newDate = formatLocalDate(now)
    if (newDate === this.todayDate) return

    const midnight = new Date(now)
    midnight.setHours(0, 0, 0, 0)
    const splitAt = midnight.getTime()

    if (this.currentSegment && this.currentSegment.startAt < splitAt) {
      const prev = { ...this.currentSegment }
      this.closeCurrentSegment(splitAt)
      await timeCoachStore.saveSegments(this.todayDate, this.todaySegments)

      this.todayDate = newDate
      this.todaySegments = await timeCoachStore.getSegments(this.todayDate)
      this.currentSegment = {
        ...prev,
        id: randomUUID(),
        date: newDate,
        startAt: splitAt,
        endAt: now,
        durationSec: Math.round((now - splitAt) / 1000)
      }
      this.dirty = true
    } else {
      await this.flushIfDirty()
      this.todayDate = newDate
      this.todaySegments = await timeCoachStore.getSegments(this.todayDate)
    }
  }

  private closeCurrentSegment(endAt: number): void {
    if (!this.currentSegment) return
    const clampedEnd = Math.max(this.currentSegment.startAt, endAt)
    const durationSec = Math.round((clampedEnd - this.currentSegment.startAt) / 1000)
    if (durationSec >= 1) {
      this.todaySegments.push({
        ...this.currentSegment,
        endAt: clampedEnd,
        durationSec
      })
      this.dirty = true
    }
    this.currentSegment = null
  }

  private async pollOnce(): Promise<void> {
    if (this.isPolling || (this.state !== 'active' && this.state !== 'idle')) return
    this.isPolling = true

    try {
      const now = Date.now()
      await this.ensureDateRollover(now)

      const idleSec = powerMonitor.getSystemIdleTime()
      const threshold = this.currentIdleThresholdSec || this.settings.idleThresholdSec

      if (idleSec >= threshold) {
        if (this.state !== 'idle') {
          // 回溯扣除已处于闲置的时间，避免把离开电脑算作工作
          const idleStart = Math.max(
            this.currentSegment?.startAt ?? now,
            now - idleSec * 1000
          )
          this.closeCurrentSegment(idleStart)
          this.state = 'idle'
          this.currentSegment = {
            id: randomUUID(),
            date: this.todayDate,
            state: 'idle',
            startAt: idleStart,
            endAt: now,
            durationSec: Math.round((now - idleStart) / 1000)
          }
          this.dirty = true
          this.notifyListeners()
        } else if (this.currentSegment) {
          this.currentSegment.endAt = now
          this.currentSegment.durationSec = Math.round((now - this.currentSegment.startAt) / 1000)
          this.dirty = true
        }
        return
      }

      if (this.state === 'idle') {
        this.closeCurrentSegment(now)
        this.state = 'active'
      }

      const fg = await this.provider.getForegroundWindow()
      if (!fg) {
        if (this.currentSegment) {
          this.currentSegment.endAt = now
          this.currentSegment.durationSec = Math.round((now - this.currentSegment.startAt) / 1000)
          this.dirty = true
        }
        return
      }

      const match = await activityRuleService.match(fg.appName, fg.windowTitle)
      this.currentIdleThresholdSec =
        match.idleThresholdSec ??
        (match.category === 'research'
          ? this.settings.passiveIdleThresholdSec
          : this.settings.idleThresholdSec)

      const appKey = match.resolvedAppKey
      const appName = match.resolvedAppName
      const windowTitle =
        match.isPrivacy || !this.settings.saveWindowTitle ? undefined : fg.windowTitle.slice(0, 120)

      const canMerge =
        this.currentSegment &&
        this.currentSegment.state === 'active' &&
        this.currentSegment.category === match.category &&
        this.currentSegment.appKey === appKey

      if (canMerge && this.currentSegment) {
        this.currentSegment.endAt = now
        this.currentSegment.durationSec = Math.round((now - this.currentSegment.startAt) / 1000)
        if (windowTitle) this.currentSegment.windowTitle = windowTitle
        this.dirty = true
      } else {
        this.closeCurrentSegment(now)
        this.currentSegment = {
          id: randomUUID(),
          date: this.todayDate,
          state: 'active',
          category: match.category,
          appKey,
          appName,
          ...(windowTitle ? { windowTitle } : {}),
          startAt: now,
          endAt: now,
          durationSec: 0
        }
        this.dirty = true
        this.notifyListeners()
      }

      this.lastError = undefined
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err)
    } finally {
      this.isPolling = false
      this.scheduleNextPoll()
    }
  }

  private async flushIfDirty(): Promise<void> {
    if (!this.dirty) return
    const snapshot = this.getMergedSegmentsForToday()
    await timeCoachStore.saveSegments(this.todayDate, snapshot)
    await timeCoachStore.saveCheckpoint({
      date: this.todayDate,
      lastAliveAt: Date.now(),
      state: this.state
    })
    this.dirty = false
  }

  async getDailySummary(date?: string): Promise<DailyTimeSummary> {
    const target = date || this.todayDate
    if (target === this.todayDate) {
      return computeDailySummary(target, this.getMergedSegmentsForToday())
    }
    const segments = await timeCoachStore.getSegments(target)
    return computeDailySummary(target, segments)
  }

  async getTrends(days = 7): Promise<TrendPoint[]> {
    const clampedDays = Math.min(30, Math.max(1, Math.round(days)))
    const dates = getRecentDates(clampedDays, this.todayDate)
    const points: TrendPoint[] = []
    for (const d of dates) {
      const summary = await this.getDailySummary(d)
      points.push(summaryToTrendPoint(summary))
    }
    return points
  }

  async getSettings(): Promise<TimeCoachSettings> {
    return this.settings
  }

  async updateSettings(patch: TimeCoachSettingsPatch): Promise<TimeCoachSettings> {
    const prevEnabled = this.settings.enabled
    this.settings = await timeCoachStore.patchSettings(patch)
    if (!prevEnabled && this.settings.enabled) {
      await this.start()
    } else if (prevEnabled && !this.settings.enabled) {
      await this.stop()
    }
    this.notifyListeners()
    return this.settings
  }

  async reclassify(req: ReclassifyRequest): Promise<DailyTimeSummary> {
    const targetDate = req.date || this.todayDate
    const updateList = (list: ActivitySegment[]): ActivitySegment[] =>
      list.map((seg) => {
        if (req.segmentId && seg.id === req.segmentId) {
          return {
            ...seg,
            category: req.category,
            ...(req.category === 'private' ? { appName: undefined, windowTitle: undefined, appKey: 'private' } : {})
          }
        }
        if (req.appName && seg.appName === req.appName) {
          return {
            ...seg,
            category: req.category,
            ...(req.category === 'private' ? { appName: undefined, windowTitle: undefined, appKey: 'private' } : {})
          }
        }
        return seg
      })

    if (targetDate === this.todayDate) {
      this.todaySegments = updateList(this.todaySegments)
      if (this.currentSegment) {
        this.currentSegment = updateList([this.currentSegment])[0]
      }
      this.dirty = true
      await this.flushIfDirty()
    } else {
      const segs = await timeCoachStore.getSegments(targetDate)
      await timeCoachStore.saveSegments(targetDate, updateList(segs))
    }

    if (req.createRule && req.appName) {
      await activityRuleService.saveUserRule({
        name: `自定义: ${req.appName}`,
        appPattern: `^${req.appName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        category: req.category,
        isPrivacy: req.category === 'private',
        priority: 920
      })
    }

    this.notifyListeners()
    return this.getDailySummary(targetDate)
  }

  async buildAiDigest(date?: string, days = 7): Promise<string> {
    const target = date || this.todayDate
    const summary = await this.getDailySummary(target)
    const trends = await this.getTrends(days)
    const note = await timeCoachStore.getDailyNote(target)
    return activityRuleService.buildAiDigest(summary, trends, note)
  }

  async clearHistory(date?: string): Promise<void> {
    if (!date || date === this.todayDate) {
      this.todaySegments = []
      this.currentSegment = null
      this.dirty = false
    }
    await timeCoachStore.clearHistory(date)
    this.notifyListeners()
  }

  disposeSync(): void {
    this.clearPollTimer()
    this.clearFlushTimer()
    this.closeCurrentSegment(Date.now())
    if (this.dirty) {
      timeCoachStore.saveSegmentsSync(this.todayDate, this.todaySegments)
      this.dirty = false
    }
    this.provider.dispose()
  }
}

export const activityTrackerService = new ActivityTrackerService()
