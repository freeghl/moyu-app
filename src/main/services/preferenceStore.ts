import { randomUUID } from 'node:crypto'
import { copyFile, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import {
  createDefaultPreferences,
  mergePreferences,
  normalizePreferences,
  type AppPreferences,
  type PreferencesPatch
} from '@shared/preferences'

class PreferenceStore {
  private state?: Promise<AppPreferences>
  private cached?: AppPreferences
  private writes: Promise<unknown> = Promise.resolve()
  private listeners = new Set<(preferences: AppPreferences) => void>()

  subscribe(listener: (preferences: AppPreferences) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(preferences: AppPreferences): void {
    for (const listener of this.listeners) {
      try {
        listener(preferences)
      } catch {
        // 单个订阅者出错不影响其他订阅者
      }
    }
  }


  private get filePath(): string {
    return join(app.getPath('userData'), 'preferences.json')
  }

  get(): Promise<AppPreferences> {
    return this.writes.then(() => this.read())
  }

  patch(patch: PreferencesPatch): Promise<AppPreferences> {
    const run = this.writes.then(async () => {
      const base = await this.read()
      const next = normalizePreferences(mergePreferences(base, patch))
      await this.persist(next)
      this.state = Promise.resolve(next)
      this.cached = next
      this.notify(next)
      return next
    })
    this.writes = run.then(() => undefined, () => undefined)
    return run
  }

  /** 退出前同步落盘（窗口尺寸等），避免异步写被进程退出裁掉 */
  patchSync(patch: PreferencesPatch): void {
    if (!this.cached) return
    try {
      const next = normalizePreferences(mergePreferences(this.cached, patch))
      const destination = this.filePath
      const temporary = `${destination}.${randomUUID()}.tmp`
      writeFileSync(temporary, JSON.stringify(next, null, 2))
      renameSync(temporary, destination)
      this.state = Promise.resolve(next)
      this.cached = next
      this.notify(next)
    } catch {
      // 退出阶段不抛出，写入失败下次启动仍可用默认值
    }
  }

  private read(): Promise<AppPreferences> {
    this.state ??= this.load().catch((error) => {
      this.state = undefined
      throw error
    })
    return this.state.then((value) => {
      this.cached = value
      return value
    })
  }

  private async load(): Promise<AppPreferences> {
    try {
      const raw: unknown = JSON.parse(await readFile(this.filePath, 'utf8'))
      return normalizePreferences(raw)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return createDefaultPreferences()
      // 文件损坏时先备份再回退默认值，避免用户永久卡在错误状态
      await copyFile(this.filePath, `${this.filePath}.broken-${Date.now()}.json`).catch(() => undefined)
      return createDefaultPreferences()
    }
  }

  private async persist(preferences: AppPreferences): Promise<void> {
    const destination = this.filePath
    const temporary = `${destination}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, JSON.stringify(preferences, null, 2), { flag: 'wx' })
      await rename(temporary, destination)
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined)
    }
  }
}

export const preferenceStore = new PreferenceStore()
