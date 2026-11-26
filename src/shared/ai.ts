export type AiProviderType = 'openai-compatible' | 'anthropic' | 'ollama'

export interface AiProviderPreset {
  id: string
  name: string
  provider: AiProviderType
  baseUrl: string
  defaultModel: string
  requiresApiKey: boolean
  description: string
}

export const AI_PROVIDER_PRESETS: readonly AiProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    provider: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    requiresApiKey: true,
    description: '官方 OpenAI 接口或兼容代理'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    provider: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    requiresApiKey: true,
    description: 'DeepSeek V3 / R1 对话与推理模型'
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-latest',
    requiresApiKey: true,
    description: 'Anthropic Messages API'
  },
  {
    id: 'ollama',
    name: 'Ollama (本地)',
    provider: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'qwen2.5:7b',
    requiresApiKey: false,
    description: '本地运行的开源大模型，无需 API Key'
  },
  {
    id: 'custom',
    name: '自定义 OpenAI 兼容',
    provider: 'openai-compatible',
    baseUrl: '',
    defaultModel: '',
    requiresApiKey: true,
    description: 'OneAPI / NewAPI / 硅基流动 / 火山方舟等'
  }
]

/** 暴露给渲染进程与插件的脱敏 AI 配置（不含明文 apiKey） */
export interface AiProfile {
  id: string
  name: string
  provider: AiProviderType
  baseUrl: string
  model: string
  hasApiKey: boolean
  maskedApiKey: string
  /** 自定义认证请求头名（留空则使用协议默认：Authorization 或 x-api-key） */
  authHeaderName?: string
  /** 自定义认证前缀（如 Bearer；传空字符串表示不带前缀直接发送 Key） */
  authHeaderPrefix?: string
  /** 附加自定义请求头 */
  customHeaders?: Record<string, string>
  temperature: number
  enabled: boolean
  updatedAt: number
}

/** 创建或更新配置时的输入结构 */
export interface AiProfileInput {
  id?: string
  name: string
  provider: AiProviderType
  baseUrl: string
  model: string
  /** 编辑时留空或 undefined 表示保持原密钥不变；传入新字符串则覆盖 */
  apiKey?: string
  /** 是否显式清空已保存的 API Key */
  clearApiKey?: boolean
  authHeaderName?: string
  authHeaderPrefix?: string
  customHeaders?: Record<string, string>
  temperature?: number
  enabled?: boolean
}

export interface AiConfigState {
  defaultProfileId: string | null
  profiles: AiProfile[]
}

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiChatRequest {
  requestId: string
  /** 不传则自动使用全局默认配置 */
  profileId?: string
  messages: AiMessage[]
  temperature?: number
}

export interface AiChatResponse {
  content: string
  model: string
  profileId: string
}

export interface AiStreamChunk {
  requestId: string
  delta?: string
  done: boolean
  error?: string
}

export interface AiTestResult {
  ok: boolean
  latencyMs: number
  message: string
  replyPreview?: string
}

export interface AiModelListResult {
  ok: boolean
  models: string[]
  message?: string
}
