import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type {
  ActivityRule,
  ActivitySegment,
  TimeCoachDailyNote,
  TimeCoachSettings,
  TimeCoachSettingsPatch
} from '@shared/timeCoach'

export interface TimeCoachCheckpoint {
  date: string
  lastAliveAt: number
  state: string
}

export const DEFAULT_TIME_COACH_SETTINGS: TimeCoachSettings = {
  enabled: false,
  pollIntervalSec: 4,
  idleThresholdSec: 180,
  passiveIdleThresholdSec: 600,
  saveWindowTitle: false,
  retentionDays: 90,
  breakReminderEnabled: true,
  breakReminderMinutes: 90
}

export function formatLocalDate(ts = Date.now()): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getRecentDates(days: number, endDate = formatLocalDate()): string[] {
  const [y, m, d] = endDate.split('-').map(Number)
  const base = new Date(y, (m || 1) - 1, d || 1)
  const result: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const cur = new Date(base)
    cur.setDate(base.getDate() - i)
    result.push(formatLocalDate(cur.getTime()))
  }
  return result
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function normalizeSettings(raw: unknown): TimeCoachSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_TIME_COACH_SETTINGS }
  const obj = raw as Record<string, unknown>
  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : DEFAULT_TIME_COACH_SETTINGS.enabled,
    pollIntervalSec: clampInt(obj.pollIntervalSec, DEFAULT_TIME_COACH_SETTINGS.pollIntervalSec, 2, 30),
    idleThresholdSec: clampInt(obj.idleThresholdSec, DEFAULT_TIME_COACH_SETTINGS.idleThresholdSec, 30, 1800),
    passiveIdleThresholdSec: clampInt(
      obj.passiveIdleThresholdSec,
      DEFAULT_TIME_COACH_SETTINGS.passiveIdleThresholdSec,
      60,
      3600
    ),
    saveWindowTitle:
      typeof obj.saveWindowTitle === 'boolean'
        ? obj.saveWindowTitle
        : DEFAULT_TIME_COACH_SETTINGS.saveWindowTitle,
    retentionDays: clampInt(obj.retentionDays, DEFAULT_TIME_COACH_SETTINGS.retentionDays, 7, 365),
    breakReminderEnabled:
      typeof obj.breakReminderEnabled === 'boolean'
        ? obj.breakReminderEnabled
        : DEFAULT_TIME_COACH_SETTINGS.breakReminderEnabled,
    breakReminderMinutes: clampInt(
      obj.breakReminderMinutes,
      DEFAULT_TIME_COACH_SETTINGS.breakReminderMinutes,
      15,
      240
    )
  }
}

class TimeCoachStore {
  private writeQueue: Promise<unknown> = Promise.resolve()

  private baseDir(): string {
    return join(app.getPath('userData'), 'time-coach')
  }

  private activitiesDir(): string {
    return join(this.baseDir(), 'activities')
  }

  private notesDir(): string {
    return join(this.baseDir(), 'notes')
  }

  private settingsPath(): string {
    return join(this.baseDir(), 'settings.json')
  }

  private rulesPath(): string {
    return join(this.baseDir(), 'rules.json')
  }

  private checkpointPath(): string {
    return join(this.baseDir(), 'checkpoint.json')
  }

  private activityPath(date: string): string {
    return join(this.activitiesDir(), `${date}.json`)
  }

  private notePath(date: string): string {
    return join(this.notesDir(), `${date}.json`)
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.writeQueue.then(task, task)
    this.writeQueue = run.catch(() => undefined)
    return run
  }

  private async atomicWriteJson(filePath: string, data: unknown): Promise<void> {
    await mkdir(join(filePath, '..'), { recursive: true })
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`
    await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
    await rename(tmp, filePath)
  }

  private async readJson<T>(filePath: string, fallback: T): Promise<T> {
    try {
      const raw = await readFile(filePath, 'utf8')
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }

  async getSettings(): Promise<TimeCoachSettings> {
    const raw = await this.readJson<unknown>(this.settingsPath(), null)
    return normalizeSettings(raw)
  }

  async patchSettings(patch: TimeCoachSettingsPatch): Promise<TimeCoachSettings> {
    return this.enqueue(async () => {
      const current = await this.getSettings()
      const next = normalizeSettings({ ...current, ...patch })
      await this.atomicWriteJson(this.settingsPath(), next)
      return next
    })
  }

  async getUserRules(): Promise<ActivityRule[] | null> {
    const raw = await this.readJson<ActivityRule[] | null>(this.rulesPath(), null)
    return Array.isArray(raw) ? raw : null
  }

  async saveUserRules(rules: ActivityRule[]): Promise<void> {
    await this.enqueue(async () => {
      await this.atomicWriteJson(this.rulesPath(), rules)
    })
  }

  async getSegments(date: string): Promise<ActivitySegment[]> {
    const raw = await this.readJson<{ version?: number; segments?: ActivitySegment[] } | ActivitySegment[]>(
      this.activityPath(date),
      []
    )
    if (Array.isArray(raw)) return raw
    return Array.isArray(raw?.segments) ? raw.segments : []
  }

  async saveSegments(date: string, segments: ActivitySegment[]): Promise<void> {
    await this.enqueue(async () => {
      await this.atomicWriteJson(this.activityPath(date), {
        version: 1,
        date,
        updatedAt: Date.now(),
        segments
      })
    })
  }

  saveSegmentsSync(date: string, segments: ActivitySegment[]): void {
    try {
      const dir = this.activitiesDir()
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(
        this.activityPath(date),
        JSON.stringify({ version: 1, date, updatedAt: Date.now(), segments }, null, 2),
        'utf8'
      )
    } catch {
      // ignore on exit
    }
  }

  async saveCheckpoint(cp: TimeCoachCheckpoint): Promise<void> {
    await this.enqueue(async () => {
      await this.atomicWriteJson(this.checkpointPath(), cp)
    })
  }

  async getDailyNote(date: string): Promise<TimeCoachDailyNote> {
    const fallback: TimeCoachDailyNote = { date, updatedAt: 0 }
    const raw = await this.readJson<Partial<TimeCoachDailyNote>>(this.notePath(date), fallback)
    return {
      date,
      energyScore: typeof raw.energyScore === 'number' ? raw.energyScore : undefined,
      goal: typeof raw.goal === 'string' ? raw.goal : undefined,
      note: typeof raw.note === 'string' ? raw.note : undefined,
      aiReview: typeof raw.aiReview === 'string' ? raw.aiReview : undefined,
      aiReport: typeof raw.aiReport === 'string' ? raw.aiReport : undefined,
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0
    }
  }

  async saveDailyNote(patch: Partial<TimeCoachDailyNote> & { date: string }): Promise<TimeCoachDailyNote> {
    return this.enqueue(async () => {
      const current = await this.getDailyNote(patch.date)
      const next: TimeCoachDailyNote = {
        ...current,
        ...patch,
        date: patch.date,
        updatedAt: Date.now()
      }
      await this.atomicWriteJson(this.notePath(patch.date), next)
      return next
    })
  }

  async clearHistory(date?: string): Promise<void> {
    await this.enqueue(async () => {
      if (date) {
        await rm(this.activityPath(date), { force: true })
        await rm(this.notePath(date), { force: true })
        return
      }
      await rm(this.activitiesDir(), { recursive: true, force: true })
      await rm(this.notesDir(), { recursive: true, force: true })
      await rm(this.checkpointPath(), { force: true })
    })
  }

  async cleanupExpired(retentionDays: number): Promise<void> {
    const cutoffDate = getRecentDates(retentionDays)[0]
    if (!cutoffDate) return
    await this.enqueue(async () => {
      for (const dir of [this.activitiesDir(), this.notesDir()]) {
        if (!existsSync(dir)) continue
        const files = await readdir(dir).catch(() => [])
        for (const file of files) {
          if (!file.endsWith('.json')) continue
          const fileDate = file.slice(0, -5)
          if (/^\d{4}-\d{2}-\d{2}$/.test(fileDate) && fileDate < cutoffDate) {
            await rm(join(dir, file), { force: true })
          }
        }
      }
    })
  }
}

export const timeCoachStore = new TimeCoachStore()
