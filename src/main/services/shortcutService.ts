import { globalShortcut } from 'electron'
import type { AppSettings } from '@shared/preferences'

export interface ShortcutHandlers {
  toggleBoss: () => void
  toggleHide: () => void
  summon: () => void
  previousVideo: () => void
  nextVideo: () => void
}

export interface ShortcutApplyResult {
  ok: boolean
  error?: string
}

type ShortcutKeys = Pick<AppSettings, 'bossKey' | 'hideKey' | 'summonKey' | 'videoPreviousKey' | 'videoNextKey'>

class ShortcutService {
  private keys: ShortcutKeys = {
    bossKey: '',
    hideKey: '',
    summonKey: '',
    videoPreviousKey: '',
    videoNextKey: ''
  }
  private handlers?: ShortcutHandlers
  private hoverVideoActive = false
  private videoShortcutsRegistered = false

  setHandlers(handlers: ShortcutHandlers): void {
    this.handlers = handlers
  }

  setHoverVideoActive(active: boolean): ShortcutApplyResult {
    if (this.hoverVideoActive === active) return { ok: true }
    this.hoverVideoActive = active
    if (!active) {
      this.unregisterVideoShortcuts()
      return { ok: true }
    }
    const error = this.registerVideoShortcuts()
    return error ? { ok: false, error } : { ok: true }
  }

  apply(keys: ShortcutKeys): ShortcutApplyResult {
    const wanted: ShortcutKeys = {
      bossKey: keys.bossKey.trim(),
      hideKey: keys.hideKey.trim(),
      summonKey: keys.summonKey.trim(),
      videoPreviousKey: keys.videoPreviousKey.trim(),
      videoNextKey: keys.videoNextKey.trim()
    }
    const values = Object.values(wanted).filter(Boolean)
    if (new Set(values).size !== values.length) {
      return { ok: false, error: '快捷键不能使用同一个组合' }
    }

    const previous = this.keys
    this.unregisterAll()
    this.keys = wanted

    const definitions: { key: keyof ShortcutKeys; label: string; run: () => void }[] = [
      { key: 'bossKey', label: '老板键', run: () => this.handlers?.toggleBoss() },
      { key: 'hideKey', label: '快速隐藏', run: () => this.handlers?.toggleHide() },
      { key: 'summonKey', label: '全局唤出', run: () => this.handlers?.summon() }
    ]
    let failure = definitions
      .map((definition) => this.tryRegister(wanted[definition.key], definition.run, definition.label))
      .find((result): result is string => Boolean(result))
    if (!failure && this.hoverVideoActive) failure = this.registerVideoShortcuts()

    if (failure) {
      this.unregisterAll()
      this.keys = previous
      for (const definition of definitions) {
        this.tryRegister(previous[definition.key], definition.run, definition.label)
      }
      if (this.hoverVideoActive) this.registerVideoShortcuts()
      return { ok: false, error: failure }
    }

    return { ok: true }
  }

  dispose(): void {
    this.hoverVideoActive = false
    this.unregisterAll()
    this.keys = {
      bossKey: '',
      hideKey: '',
      summonKey: '',
      videoPreviousKey: '',
      videoNextKey: ''
    }
  }

  private registerVideoShortcuts(): string | undefined {
    if (!this.hoverVideoActive || this.videoShortcutsRegistered) return
    const failure = this.tryRegister(
      this.keys.videoPreviousKey,
      () => this.handlers?.previousVideo(),
      '视频上一条'
    ) || this.tryRegister(
      this.keys.videoNextKey,
      () => this.handlers?.nextVideo(),
      '视频下一条'
    )
    if (failure) {
      this.unregisterVideoShortcuts()
      return failure
    }
    this.videoShortcutsRegistered = true
  }

  private unregisterVideoShortcuts(): void {
    if (this.keys.videoPreviousKey) globalShortcut.unregister(this.keys.videoPreviousKey)
    if (this.keys.videoNextKey) globalShortcut.unregister(this.keys.videoNextKey)
    this.videoShortcutsRegistered = false
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
    this.unregisterVideoShortcuts()
    globalShortcut.unregisterAll()
  }
}

export const shortcutService = new ShortcutService()
