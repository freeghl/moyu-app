import { globalShortcut } from 'electron'
import type { AppSettings } from '@shared/preferences'

export interface ShortcutHandlers {
  toggleBoss: () => void
  toggleHide: () => void
  summon: () => void
}

export interface ShortcutApplyResult {
  ok: boolean
  error?: string
}

type ShortcutKeys = Pick<AppSettings, 'bossKey' | 'hideKey' | 'summonKey'>

class ShortcutService {
  private registered: Partial<ShortcutKeys> = {}
  private handlers?: ShortcutHandlers

  setHandlers(handlers: ShortcutHandlers): void {
    this.handlers = handlers
  }

  apply(keys: ShortcutKeys): ShortcutApplyResult {
    const wanted: ShortcutKeys = {
      bossKey: keys.bossKey.trim(),
      hideKey: keys.hideKey.trim(),
      summonKey: keys.summonKey.trim()
    }
    const values = Object.values(wanted).filter(Boolean)
    if (new Set(values).size !== values.length) {
      return { ok: false, error: '三个快捷键不能使用同一个组合' }
    }

    const previous = { ...this.registered }
    this.unregisterAll()

    const definitions: { key: keyof ShortcutKeys; label: string; run: () => void }[] = [
      { key: 'bossKey', label: '老板键', run: () => this.handlers?.toggleBoss() },
      { key: 'hideKey', label: '快速隐藏', run: () => this.handlers?.toggleHide() },
      { key: 'summonKey', label: '全局唤出', run: () => this.handlers?.summon() }
    ]
    const failure = definitions
      .map((definition) => this.tryRegister(wanted[definition.key], definition.run, definition.label))
      .find((result): result is string => Boolean(result))

    if (failure) {
      this.unregisterAll()
      for (const definition of definitions) {
        this.tryRegister(previous[definition.key], definition.run, definition.label)
      }
      this.registered = previous
      return { ok: false, error: failure }
    }

    this.registered = wanted
    return { ok: true }
  }

  dispose(): void {
    this.unregisterAll()
    this.registered = {}
  }

  private tryRegister(accelerator: string | undefined, callback: () => void, label: string): string | undefined {
    if (!accelerator) return
    try {
      const ok = globalShortcut.register(accelerator, callback)
      return ok ? undefined : `${label}「${accelerator}」已被其他程序占用`
    } catch {
      return `${label}「${accelerator}」不是合法的快捷键组合`
    }
  }

  private unregisterAll(): void {
    globalShortcut.unregisterAll()
    this.registered = {}
  }
}

export const shortcutService = new ShortcutService()
