import { ipcMain, type BrowserWindow } from 'electron'
import type {
  ActivityRuleInput,
  ReclassifyRequest,
  TimeCoachDailyNote,
  TimeCoachSettingsPatch
} from '@shared/timeCoach'
import { isTrustedSender } from './guard'
import { activityTrackerService } from '../services/time-coach/activityTrackerService'
import { activityRuleService } from '../services/time-coach/activityRuleService'
import { formatLocalDate, timeCoachStore } from '../services/time-coach/timeCoachStore'

export function registerTimeCoachIpc(): void {
  ipcMain.handle('time-coach:get-status', (event) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return activityTrackerService.getStatus()
  })

  ipcMain.handle('time-coach:start', (event) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return activityTrackerService.start()
  })

  ipcMain.handle('time-coach:pause', (event) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return activityTrackerService.pause()
  })

  ipcMain.handle('time-coach:resume', (event) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return activityTrackerService.resume()
  })

  ipcMain.handle('time-coach:stop', (event) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return activityTrackerService.stop()
  })

  ipcMain.handle('time-coach:dismiss-break', (event) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return activityTrackerService.dismissBreakReminder()
  })

  ipcMain.handle('time-coach:get-daily-summary', (event, date?: string) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return activityTrackerService.getDailySummary(date)
  })

  ipcMain.handle('time-coach:get-trends', (event, days?: number) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return activityTrackerService.getTrends(days)
  })

  ipcMain.handle('time-coach:get-settings', (event) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return activityTrackerService.getSettings()
  })

  ipcMain.handle('time-coach:update-settings', (event, patch: TimeCoachSettingsPatch) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return activityTrackerService.updateSettings(patch)
  })

  ipcMain.handle('time-coach:list-rules', (event) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return activityRuleService.getAllRules()
  })

  ipcMain.handle('time-coach:save-rule', (event, input: ActivityRuleInput) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return activityRuleService.saveUserRule(input)
  })

  ipcMain.handle('time-coach:delete-rule', (event, id: string) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return activityRuleService.deleteUserRule(id)
  })

  ipcMain.handle('time-coach:reclassify', (event, req: ReclassifyRequest) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return activityTrackerService.reclassify(req)
  })

  ipcMain.handle('time-coach:get-daily-note', (event, date?: string) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return timeCoachStore.getDailyNote(date || formatLocalDate())
  })

  ipcMain.handle(
    'time-coach:save-daily-note',
    (event, note: Partial<TimeCoachDailyNote> & { date: string }) => {
      if (!isTrustedSender(event)) throw new Error('来源不可信')
      return timeCoachStore.saveDailyNote(note)
    }
  )

  ipcMain.handle('time-coach:build-ai-digest', (event, date?: string, days?: number) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return activityTrackerService.buildAiDigest(date, days)
  })

  ipcMain.handle('time-coach:clear-history', (event, date?: string) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return activityTrackerService.clearHistory(date)
  })
}

export function setupTimeCoachEvents(window: BrowserWindow): () => void {
  const unsubscribe = activityTrackerService.subscribe((status) => {
    if (!window.isDestroyed()) {
      window.webContents.send('time-coach:status-changed', status)
    }
  })
  window.on('closed', unsubscribe)
  return unsubscribe
}
