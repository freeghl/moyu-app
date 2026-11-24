import { globalShortcut } from 'electron'
import type { AppSettings } from '@shared/preferences'

export interface ShortcutHandlers {
  toggleBoss: () => void
  summon: () => void
}

export interface ShortcutApplyResult {
  ok: boolean
  error?: string
}

type Keys = Pick<AppSettings, 'bossKey' | 'summonKey'>

class ShortcutService {
  private registered: { bossKey?: string; summonKey?: string } = {}
  private handlers?: ShortcutHandlers

  setHandlers(handlers: ShortcutHandlers): void {
    this.handlers = handlers
  }

  /** 重新注册全部全局快捷键；失败时回滚到上一组，避免用户点一次就全丢 */
  apply(keys: Keys): ShortcutApplyResult {
    const wanted = {
      bossKey: keys.bossKey.trim(),
      summonKey: keys.summonKey.trim()
    }
    if (wanted.bossKey && wanted.summonKey && wanted.bossKey === wanted.summonKey) {
      return { ok: false, error: '老板键与全局唤出不能使用同一个组合' }
    }

    const previous = { ...this.registered }
    this.unregisterAll()

    const failure = this.tryRegister(wanted.bossKey, () => this.handlers?.toggleBoss(), '老板键') ??
      this.tryRegister(wanted.summonKey, () => this.handlers?.summon(), '全局唤出')

    if (failure) {
      this.unregisterAll()
      this.tryRegister(previous.bossKey, () => this.handlers?.toggleBoss(), '老板键')
      this.tryRegister(previous.summonKey, () => this.handlers?.summon(), '全局唤出')
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
