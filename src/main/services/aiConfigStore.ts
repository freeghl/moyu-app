import { randomUUID } from 'node:crypto'
import { copyFile, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import type {
  AiConfigState,
  AiProfile,
  AiProfileInput,
  AiProviderType
} from '@shared/ai'

interface StoredSecret {
  encrypted: boolean
  value: string
}

interface StoredAiProfile {
  id: string
  name: string
  provider: AiProviderType
  baseUrl: string
  model: string
  secret?: StoredSecret
  temperature: number
  maxTokens: number
  enabled: boolean
  updatedAt: number
}

interface StoredAiConfig {
  defaultProfileId: string | null
  profiles: StoredAiProfile[]
}

export interface ResolvedAiProfile {
  id: string
  name: string
  provider: AiProviderType
  baseUrl: string
  model: string
  apiKey: string
  temperature: number
  maxTokens: number
  enabled: boolean
}

const VALID_PROVIDERS: readonly AiProviderType[] = ['openai-compatible', 'anthropic', 'ollama']

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function normalizeUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '')
}

function maskSecret(secret: string): string {
  const trimmed = secret.trim()
  if (!trimmed) return ''
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}****`
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`
}

function encryptSecret(plain: string): StoredSecret | undefined {
  const trimmed = plain.trim()
  if (!trimmed) return undefined
  if (safeStorage.isEncryptionAvailable()) {
    const buffer = safeStorage.encryptString(trimmed)
    return { encrypted: true, value: buffer.toString('base64') }
  }
  return { encrypted: false, value: Buffer.from(trimmed, 'utf8').toString('base64') }
}

function decryptSecret(secret?: StoredSecret): string {
  if (!secret?.value) return ''
  try {
    const buffer = Buffer.from(secret.value, 'base64')
    if (secret.encrypted && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(buffer)
    }
    return secret.encrypted ? '' : buffer.toString('utf8')
  } catch {
    return ''
  }
}

function toPublicProfile(item: StoredAiProfile): AiProfile {
  const plainKey = decryptSecret(item.secret)
  return {
    id: item.id,
    name: item.name,
    provider: item.provider,
    baseUrl: item.baseUrl,
    model: item.model,
    hasApiKey: Boolean(plainKey),
    maskedApiKey: maskSecret(plainKey),
    temperature: item.temperature,
    maxTokens: item.maxTokens,
    enabled: item.enabled,
    updatedAt: item.updatedAt
  }
}

function createEmptyConfig(): StoredAiConfig {
  return { defaultProfileId: null, profiles: [] }
}

function normalizeStoredConfig(raw: unknown): StoredAiConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return createEmptyConfig()
  const record = raw as Record<string, unknown>
  const profiles: StoredAiProfile[] = []

  if (Array.isArray(record.profiles)) {
    for (const entry of record.profiles) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
      const item = entry as Record<string, unknown>
      const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : randomUUID()
      const provider = VALID_PROVIDERS.includes(item.provider as AiProviderType)
        ? (item.provider as AiProviderType)
        : 'openai-compatible'

      let secret: StoredSecret | undefined
      if (item.secret && typeof item.secret === 'object' && !Array.isArray(item.secret)) {
        const s = item.secret as Record<string, unknown>
        if (typeof s.value === 'string' && s.value) {
          secret = { encrypted: Boolean(s.encrypted), value: s.value }
        }
      }

      profiles.push({
        id,
        name: typeof item.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 80) : '未命名配置',
        provider,
        baseUrl: typeof item.baseUrl === 'string' ? normalizeUrl(item.baseUrl).slice(0, 512) : '',
        model: typeof item.model === 'string' ? item.model.trim().slice(0, 128) : '',
        secret,
        temperature: clampNumber(item.temperature, 0.7, 0, 2),
        maxTokens: Math.round(clampNumber(item.maxTokens, 2048, 64, 128000)),
        enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
        updatedAt: typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now()
      })
    }
  }

  const defaultId = typeof record.defaultProfileId === 'string' ? record.defaultProfileId : null
  const validDefault = defaultId && profiles.some((p) => p.id === defaultId) ? defaultId : (profiles[0]?.id ?? null)

  return { defaultProfileId: validDefault, profiles }
}

class AiConfigStore {
  private state?: Promise<StoredAiConfig>
  private writes: Promise<unknown> = Promise.resolve()

  private get filePath(): string {
    return join(app.getPath('userData'), 'ai-config.json')
  }

  async getPublicConfig(): Promise<AiConfigState> {
    const config = await this.writes.then(() => this.read())
    return this.toPublicState(config)
  }

  async saveProfile(input: AiProfileInput): Promise<AiConfigState> {
    const run = this.writes.then(async () => {
      const current = await this.read()
      const existing = input.id ? current.profiles.find((p) => p.id === input.id) : undefined

      let nextSecret = existing?.secret
      if (input.clearApiKey) {
        nextSecret = undefined
      } else if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
        nextSecret = encryptSecret(input.apiKey)
      }

      const nextProfile: StoredAiProfile = {
        id: existing?.id ?? randomUUID(),
        name: input.name.trim().slice(0, 80) || '未命名配置',
        provider: VALID_PROVIDERS.includes(input.provider) ? input.provider : 'openai-compatible',
        baseUrl: normalizeUrl(input.baseUrl).slice(0, 512),
        model: input.model.trim().slice(0, 128),
        secret: nextSecret,
        temperature: clampNumber(input.temperature, 0.7, 0, 2),
        maxTokens: Math.round(clampNumber(input.maxTokens, 2048, 64, 128000)),
        enabled: input.enabled ?? existing?.enabled ?? true,
        updatedAt: Date.now()
      }

      const profiles = existing
        ? current.profiles.map((p) => (p.id === existing.id ? nextProfile : p))
        : [nextProfile, ...current.profiles]

      const defaultProfileId = current.defaultProfileId ?? (nextProfile.enabled ? nextProfile.id : null)
      const next: StoredAiConfig = { defaultProfileId, profiles }
      await this.persist(next)
      this.state = Promise.resolve(next)
      return this.toPublicState(next)
    })
    this.writes = run.then(() => undefined, () => undefined)
    return run
  }

  async deleteProfile(id: string): Promise<AiConfigState> {
    const run = this.writes.then(async () => {
      const current = await this.read()
      const profiles = current.profiles.filter((p) => p.id !== id)
      const defaultProfileId =
        current.defaultProfileId === id
          ? (profiles.find((p) => p.enabled)?.id ?? profiles[0]?.id ?? null)
          : current.defaultProfileId
      const next: StoredAiConfig = { defaultProfileId, profiles }
      await this.persist(next)
      this.state = Promise.resolve(next)
      return this.toPublicState(next)
    })
    this.writes = run.then(() => undefined, () => undefined)
    return run
  }

  async setDefault(id: string | null): Promise<AiConfigState> {
    const run = this.writes.then(async () => {
      const current = await this.read()
      const validId = id && current.profiles.some((p) => p.id === id) ? id : null
      const next: StoredAiConfig = { ...current, defaultProfileId: validId }
      await this.persist(next)
      this.state = Promise.resolve(next)
      return this.toPublicState(next)
    })
    this.writes = run.then(() => undefined, () => undefined)
    return run
  }

  /** 仅在 Main 进程内部调用，解析真实密钥用于发起请求或测试连接 */
  async resolveForInput(input: AiProfileInput): Promise<ResolvedAiProfile> {
    const config = await this.writes.then(() => this.read())
    const existing = input.id ? config.profiles.find((p) => p.id === input.id) : undefined
    let apiKey = ''
    if (!input.clearApiKey) {
      apiKey = typeof input.apiKey === 'string' && input.apiKey.trim()
        ? input.apiKey.trim()
        : decryptSecret(existing?.secret)
    }
    return {
      id: existing?.id ?? 'draft',
      name: input.name.trim() || '测试配置',
      provider: VALID_PROVIDERS.includes(input.provider) ? input.provider : 'openai-compatible',
      baseUrl: normalizeUrl(input.baseUrl),
      model: input.model.trim(),
      apiKey,
      temperature: clampNumber(input.temperature, 0.7, 0, 2),
      maxTokens: Math.round(clampNumber(input.maxTokens, 2048, 64, 128000)),
      enabled: input.enabled ?? true
    }
  }

  async resolveProfile(profileId?: string): Promise<ResolvedAiProfile> {
    const config = await this.writes.then(() => this.read())
    const targetId = profileId || config.defaultProfileId
    const found = targetId
      ? config.profiles.find((p) => p.id === targetId)
      : config.profiles.find((p) => p.enabled)

    if (!found) {
      throw new Error('未找到可用的 AI 配置，请先在 AI 配置中心添加并启用模型')
    }
    if (!found.enabled) {
      throw new Error(`AI 配置「${found.name}」已被停用`)
    }

    return {
      id: found.id,
      name: found.name,
      provider: found.provider,
      baseUrl: found.baseUrl,
      model: found.model,
      apiKey: decryptSecret(found.secret),
      temperature: found.temperature,
      maxTokens: found.maxTokens,
      enabled: found.enabled
    }
  }

  private toPublicState(config: StoredAiConfig): AiConfigState {
    return {
      defaultProfileId: config.defaultProfileId,
      profiles: config.profiles.map(toPublicProfile)
    }
  }

  private read(): Promise<StoredAiConfig> {
    this.state ??= this.load().catch((error) => {
      this.state = undefined
      throw error
    })
    return this.state
  }

  private async load(): Promise<StoredAiConfig> {
    try {
      const raw: unknown = JSON.parse(await readFile(this.filePath, 'utf8'))
      return normalizeStoredConfig(raw)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return createEmptyConfig()
      await copyFile(this.filePath, `${this.filePath}.broken-${Date.now()}.json`).catch(() => undefined)
      return createEmptyConfig()
    }
  }

  private async persist(config: StoredAiConfig): Promise<void> {
    const destination = this.filePath
    const temporary = `${destination}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, JSON.stringify(config, null, 2), { flag: 'wx' })
      await rename(temporary, destination)
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined)
    }
  }
}

export const aiConfigStore = new AiConfigStore()
