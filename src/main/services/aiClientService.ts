import type {
  AiChatRequest,
  AiChatResponse,
  AiMessage,
  AiProfileInput,
  AiStreamChunk,
  AiTestResult
} from '@shared/ai'
import { aiConfigStore, type ResolvedAiProfile } from './aiConfigStore'

const activeControllers = new Map<string, AbortController>()

function assertProfileReady(profile: ResolvedAiProfile): void {
  if (!profile.baseUrl) {
    throw new Error(`AI 配置「${profile.name}」缺少 Base URL`)
  }
  if (!profile.model) {
    throw new Error(`AI 配置「${profile.name}」缺少模型名称`)
  }
  if (profile.provider !== 'ollama' && !profile.apiKey) {
    throw new Error(`AI 配置「${profile.name}」缺少 API Key`)
  }
}

function buildEndpoint(baseUrl: string, path: string): string {
  const normalized = baseUrl.replace(/\/+$/, '')
  return normalized.endsWith(path) ? normalized : `${normalized}${path}`
}

function extractOpenAiContent(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const choices = (data as { choices?: unknown[] }).choices
  const first = Array.isArray(choices) ? choices[0] : undefined
  if (!first || typeof first !== 'object') return ''
  const msg = (first as { message?: { content?: unknown } }).message
  return typeof msg?.content === 'string' ? msg.content : ''
}

function extractAnthropicContent(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const content = (data as { content?: unknown[] }).content
  if (!Array.isArray(content)) return ''
  return content
    .filter((block): block is { type?: string; text?: string } => Boolean(block) && typeof block === 'object')
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('')
}

function splitAnthropicMessages(messages: AiMessage[]): { system?: string; messages: Array<{ role: 'user' | 'assistant'; content: string }> } {
  const systemParts: string[] = []
  const chatMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemParts.push(msg.content)
    } else {
      chatMessages.push({ role: msg.role, content: msg.content })
    }
  }
  return {
    system: systemParts.length ? systemParts.join('\n\n') : undefined,
    messages: chatMessages.length ? chatMessages : [{ role: 'user', content: 'Hi' }]
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => '')
  if (!text) return `HTTP ${response.status} ${response.statusText}`
  try {
    const json = JSON.parse(text) as { error?: { message?: string }; message?: string }
    const msg = json.error?.message || json.message
    if (msg) return `HTTP ${response.status}: ${msg}`
  } catch {
    // 非 JSON 错误体直接截断返回
  }
  return `HTTP ${response.status}: ${text.slice(0, 240)}`
}

async function requestCompletion(
  profile: ResolvedAiProfile,
  messages: AiMessage[],
  temperature: number,
  maxTokens: number,
  signal: AbortSignal
): Promise<string> {
  assertProfileReady(profile)

  if (profile.provider === 'anthropic') {
    const payload = splitAnthropicMessages(messages)
    const response = await fetch(buildEndpoint(profile.baseUrl, '/messages'), {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': profile.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: profile.model,
        max_tokens: maxTokens,
        temperature,
        ...(payload.system ? { system: payload.system } : {}),
        messages: payload.messages
      })
    })
    if (!response.ok) throw new Error(await readErrorMessage(response))
    return extractAnthropicContent(await response.json())
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (profile.apiKey) headers.Authorization = `Bearer ${profile.apiKey}`

  const response = await fetch(buildEndpoint(profile.baseUrl, '/chat/completions'), {
    method: 'POST',
    signal,
    headers,
    body: JSON.stringify({
      model: profile.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    })
  })
  if (!response.ok) throw new Error(await readErrorMessage(response))
  return extractOpenAiContent(await response.json())
}

async function parseSseLines(
  body: ReadableStream<Uint8Array>,
  onEvent: (data: string) => void
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload) onEvent(payload)
    }
  }

  const tail = buffer.trim()
  if (tail.startsWith('data:')) {
    const payload = tail.slice(5).trim()
    if (payload) onEvent(payload)
  }
}

export const aiClientService = {
  async testConnection(input: AiProfileInput): Promise<AiTestResult> {
    const started = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)

    try {
      const profile = await aiConfigStore.resolveForInput(input)
      const reply = await requestCompletion(
        profile,
        [{ role: 'user', content: '请回复 "OK" 两个字母用于连通性测试。' }],
        0,
        16,
        controller.signal
      )
      return {
        ok: true,
        latencyMs: Date.now() - started,
        message: '连接成功，模型响应正常',
        replyPreview: reply.trim().slice(0, 60)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return {
        ok: false,
        latencyMs: Date.now() - started,
        message: msg.includes('aborted') ? '请求超时（15s），请检查网络或 Base URL' : msg
      }
    } finally {
      clearTimeout(timer)
    }
  },

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const profile = await aiConfigStore.resolveProfile(request.profileId)
    const controller = new AbortController()
    activeControllers.set(request.requestId, controller)

    try {
      const content = await requestCompletion(
        profile,
        request.messages,
        request.temperature ?? profile.temperature,
        request.maxTokens ?? profile.maxTokens,
        controller.signal
      )
      return { content, model: profile.model, profileId: profile.id }
    } finally {
      activeControllers.delete(request.requestId)
    }
  },

  async chatStream(request: AiChatRequest, emit: (chunk: AiStreamChunk) => void): Promise<void> {
    const controller = new AbortController()
    activeControllers.set(request.requestId, controller)

    try {
      const profile = await aiConfigStore.resolveProfile(request.profileId)
      assertProfileReady(profile)
      const temperature = request.temperature ?? profile.temperature
      const maxTokens = request.maxTokens ?? profile.maxTokens

      if (profile.provider === 'anthropic') {
        const payload = splitAnthropicMessages(request.messages)
        const response = await fetch(buildEndpoint(profile.baseUrl, '/messages'), {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': profile.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: profile.model,
            max_tokens: maxTokens,
            temperature,
            stream: true,
            ...(payload.system ? { system: payload.system } : {}),
            messages: payload.messages
          })
        })
        if (!response.ok) throw new Error(await readErrorMessage(response))
        if (!response.body) throw new Error('响应体为空')

        await parseSseLines(response.body, (data) => {
          try {
            const parsed = JSON.parse(data) as { type?: string; delta?: { text?: string } }
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              emit({ requestId: request.requestId, delta: parsed.delta.text, done: false })
            }
          } catch {
            // 忽略非 JSON 心跳行
          }
        })
        emit({ requestId: request.requestId, done: true })
        return
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (profile.apiKey) headers.Authorization = `Bearer ${profile.apiKey}`

      const response = await fetch(buildEndpoint(profile.baseUrl, '/chat/completions'), {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify({
          model: profile.model,
          messages: request.messages,
          temperature,
          max_tokens: maxTokens,
          stream: true
        })
      })
      if (!response.ok) throw new Error(await readErrorMessage(response))
      if (!response.body) throw new Error('响应体为空')

      await parseSseLines(response.body, (data) => {
        if (data === '[DONE]') return
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>
          }
          const delta = parsed.choices?.[0]?.delta?.content
          if (typeof delta === 'string' && delta) {
            emit({ requestId: request.requestId, delta, done: false })
          }
        } catch {
          // 忽略非 JSON 心跳行
        }
      })
      emit({ requestId: request.requestId, done: true })
    } catch (error) {
      const aborted = controller.signal.aborted
      emit({
        requestId: request.requestId,
        done: true,
        error: aborted ? '已取消生成' : (error instanceof Error ? error.message : String(error))
      })
    } finally {
      activeControllers.delete(request.requestId)
    }
  },

  abort(requestId: string): void {
    const controller = activeControllers.get(requestId)
    if (controller) {
      controller.abort()
      activeControllers.delete(requestId)
    }
  }
}
