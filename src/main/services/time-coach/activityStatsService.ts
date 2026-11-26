import type {
  ActivityCategory,
  ActivitySegment,
  DailyTimeSummary,
  FocusSession,
  TopAppStat,
  TrendPoint
} from '@shared/timeCoach'

const MAX_SHORT_INTERRUPTION_MS = 60_000
const MIN_FOCUS_SESSION_SEC = 600

function emptyCategoryTotals(): Record<ActivityCategory, number> {
  return {
    deep_work: 0,
    research: 0,
    communication: 0,
    leisure: 0,
    other: 0,
    private: 0
  }
}

function isFocusEligible(seg: ActivitySegment): boolean {
  return (
    seg.state === 'active' &&
    (seg.category === 'deep_work' || seg.category === 'research') &&
    seg.durationSec > 0
  )
}

function isBlockingGap(seg: ActivitySegment): boolean {
  return (
    seg.category === 'private' ||
    seg.state === 'locked' ||
    seg.state === 'suspended' ||
    seg.state === 'paused' ||
    seg.state === 'stopped'
  )
}

function computeFocusSessions(segments: ActivitySegment[]): FocusSession[] {
  const ordered = [...segments].sort((a, b) => a.startAt - b.startAt)
  const sessions: FocusSession[] = []

  let current: {
    startAt: number
    endAt: number
    activeDurationSec: number
    interruptionCount: number
    segmentIds: string[]
    gapMs: number
  } | null = null

  const flushCurrent = (): void => {
    if (!current) return
    if (current.activeDurationSec >= MIN_FOCUS_SESSION_SEC) {
      sessions.push({
        id: `focus-${current.startAt}`,
        startAt: current.startAt,
        endAt: current.endAt,
        activeDurationSec: current.activeDurationSec,
        interruptionCount: current.interruptionCount,
        segmentIds: current.segmentIds
      })
    }
    current = null
  }

  for (const seg of ordered) {
    if (isFocusEligible(seg)) {
      if (!current) {
        current = {
          startAt: seg.startAt,
          endAt: seg.endAt,
          activeDurationSec: seg.durationSec,
          interruptionCount: 0,
          segmentIds: [seg.id],
          gapMs: 0
        }
      } else {
        const wallGapMs = Math.max(0, seg.startAt - current.endAt)
        if (current.gapMs + wallGapMs <= MAX_SHORT_INTERRUPTION_MS) {
          if (current.gapMs > 0 || wallGapMs > 0) {
            current.interruptionCount += 1
          }
          current.endAt = seg.endAt
          current.activeDurationSec += seg.durationSec
          current.segmentIds.push(seg.id)
          current.gapMs = 0
        } else {
          flushCurrent()
          current = {
            startAt: seg.startAt,
            endAt: seg.endAt,
            activeDurationSec: seg.durationSec,
            interruptionCount: 0,
            segmentIds: [seg.id],
            gapMs: 0
          }
        }
      }
    } else if (current) {
      if (isBlockingGap(seg)) {
        flushCurrent()
      } else {
        const segMs = Math.max(0, seg.endAt - seg.startAt)
        current.gapMs += segMs
        if (current.gapMs > MAX_SHORT_INTERRUPTION_MS) {
          flushCurrent()
        }
      }
    }
  }

  flushCurrent()
  return sessions
}

export function computeDailySummary(date: string, segments: ActivitySegment[]): DailyTimeSummary {
  const ordered = [...segments].sort((a, b) => a.startAt - b.startAt)
  const categoryTotals = emptyCategoryTotals()
  const appMap = new Map<string, TopAppStat>()

  let totalActiveSec = 0
  let leisureSec = 0
  let idleSec = 0
  let switchCount = 0
  let prevAppKey: string | undefined
  let prevCategory: ActivityCategory | undefined

  for (const seg of ordered) {
    const dur = Math.max(0, seg.durationSec || Math.round((seg.endAt - seg.startAt) / 1000))
    if (seg.state === 'idle') {
      idleSec += dur
      continue
    }
    if (seg.state !== 'active') {
      continue
    }

    const cat: ActivityCategory = seg.category ?? 'other'
    categoryTotals[cat] += dur

    if (cat === 'private') {
      continue
    }

    totalActiveSec += dur
    if (cat === 'leisure') {
      leisureSec += dur
    }

    if (prevAppKey !== undefined && (prevAppKey !== seg.appKey || prevCategory !== cat)) {
      switchCount += 1
    }
    prevAppKey = seg.appKey
    prevCategory = cat

    if (seg.appName) {
      const key = `${seg.appName}::${cat}`
      const existing = appMap.get(key)
      if (existing) {
        existing.durationSec += dur
      } else {
        appMap.set(key, {
          appName: seg.appName,
          category: cat,
          durationSec: dur
        })
      }
    }
  }

  const totalWorkSec =
    categoryTotals.deep_work + categoryTotals.research + categoryTotals.communication
  const focusSessions = computeFocusSessions(ordered)
  const focusSec = focusSessions.reduce((sum, s) => sum + s.activeDurationSec, 0)
  const longestFocusSec = focusSessions.reduce(
    (max, s) => Math.max(max, s.activeDurationSec),
    0
  )

  const topApps = Array.from(appMap.values())
    .sort((a, b) => b.durationSec - a.durationSec)
    .slice(0, 12)

  return {
    date,
    totalActiveSec,
    totalWorkSec,
    focusSec,
    longestFocusSec,
    leisureSec,
    idleSec,
    switchCount,
    categoryTotals,
    topApps,
    focusSessions,
    segments: ordered
  }
}

export function summaryToTrendPoint(summary: DailyTimeSummary): TrendPoint {
  return {
    date: summary.date,
    totalWorkSec: summary.totalWorkSec,
    focusSec: summary.focusSec,
    longestFocusSec: summary.longestFocusSec,
    leisureSec: summary.leisureSec,
    switchCount: summary.switchCount,
    categoryTotals: summary.categoryTotals
  }
}
