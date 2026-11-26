import type {
  AiChatRequest,
  AiChatResponse,
  AiMessage,
  AiModelListResult,
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
  const normalized = baseUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(chat\/completions|completions|messages|models)$/i, '')
  return normalized.endsWith(path) ? normalized : `${normalized}${path}`
}

function buildHeaders(profile: ResolvedAiProfile, includeJsonContentType = true): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(profile.customHeaders ?? {})
  }
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json'
  }
  if (profile.provider === 'anthropic' && !headers['anthropic-version']) {
    headers['anthropic-version'] = '2023-06-01'
  }

  if (profile.apiKey) {
    if (profile.authHeaderName) {
      const prefix = profile.authHeaderPrefix ?? ''
      headers[profile.authHeaderName] = prefix ? `${prefix} ${profile.apiKey}` : profile.apiKey
    } else if (profile.provider === 'anthropic') {
      headers['x-api-key'] = profile.apiKey
    } else {
      const prefix = profile.authHeaderPrefix === undefined ? 'Bearer' : profile.authHeaderPrefix
      headers.Authorization = prefix ? `${prefix} ${profile.apiKey}` : profile.apiKey
    }
  }

  return headers
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
  signal: AbortSignal
): Promise<string> {
  assertProfileReady(profile)

  if (profile.provider === 'anthropic') {
    const payload = splitAnthropicMessages(messages)
    const response = await fetch(buildEndpoint(profile.baseUrl, '/messages'), {
      method: 'POST',
      signal,
      headers: buildHeaders(profile, true),
      body: JSON.stringify({
        model: profile.model,
        max_tokens: 8192,
        temperature,
        ...(payload.system ? { system: payload.system } : {}),
        messages: payload.messages
      })
    })
    if (!response.ok) throw new Error(await readErrorMessage(response))
    return extractAnthropicContent(await response.json())
  }

  const response = await fetch(buildEndpoint(profile.baseUrl, '/chat/completions'), {
    method: 'POST',
    signal,
    headers: buildHeaders(profile, true),
    body: JSON.stringify({
      model: profile.model,
      messages,
      temperature,
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

function extractModelIdsFromPayload(payload: unknown): string[] {
  const rawIds: string[] = []

  const collectFromArray = (arr: unknown[]): void => {
    for (const item of arr) {
      if (typeof item === 'string' && item.trim()) {
        rawIds.push(item.trim())
        continue
      }
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const obj = item as { id?: unknown; name?: unknown; model?: unknown }
        const id =
          typeof obj.id === 'string'
            ? obj.id
            : typeof obj.name === 'string'
              ? obj.name
              : typeof obj.model === 'string'
                ? obj.model
                : ''
        if (id.trim()) rawIds.push(id.trim())
      }
    }
  }

  if (Array.isArray(payload)) {
    collectFromArray(payload)
  } else if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (Array.isArray(record.data)) {
      collectFromArray(record.data)
    } else if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
      const nested = record.data as Record<string, unknown>
      if (Array.isArray(nested.data)) collectFromArray(nested.data)
      if (Array.isArray(nested.list)) collectFromArray(nested.list)
      if (Array.isArray(nested.models)) collectFromArray(nested.models)
      if (Array.isArray(nested.items)) collectFromArray(nested.items)
    }
    if (Array.isArray(record.models)) collectFromArray(record.models)
    if (Array.isArray(record.list)) collectFromArray(record.list)
    if (Array.isArray(record.items)) collectFromArray(record.items)
  }

  return Array.from(new Set(rawIds)).sort((a, b) => a.localeCompare(b))
}

function buildModelListEndpoints(profile: ResolvedAiProfile): string[] {
  const clean = profile.baseUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(chat\/completions|completions|messages|models)$/i, '')

  const endpoints = [`${clean}/models`]
  if (!/\/v\d+(beta)?$/i.test(clean)) {
    endpoints.push(`${clean}/v1/models`)
  }
  if (profile.provider === 'ollama') {
    const ollamaRoot = clean.replace(/\/v1$/i, '')
    endpoints.push(`${ollamaRoot}/api/tags`)
  }
  return Array.from(new Set(endpoints))
}

export const aiClientService = {
  async listModels(input: AiProfileInput): Promise<AiModelListResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)

    try {
      const profile = await aiConfigStore.resolveForInput(input)
      if (!profile.baseUrl) {
        return { ok: false, models: [], message: '请先填写 Base URL' }
      }
      if (profile.provider !== 'ollama' && !profile.apiKey) {
        return { ok: false, models: [], message: '请先填写 API Key' }
      }

      const endpoints = buildModelListEndpoints(profile)
      const headers = buildHeaders(profile, false)
      let lastError = ''

      for (const url of endpoints) {
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers
        })

        if (!response.ok) {
          lastError = `${await readErrorMessage(response)} (${url})`
          continue
        }

        const text = await response.text().catch(() => '')
        if (!text.trim()) {
          lastError = `接口返回空响应 (${url})`
          continue
        }

        let json: unknown
        try {
          json = JSON.parse(text)
        } catch {
          lastError = `接口返回的不是有效 JSON (${url})`
          continue
        }

        const models = extractModelIdsFromPayload(json)
        if (models.length > 0) {
          return {
            ok: true,
            models,
            message: `已获取 ${models.length} 个模型`
          }
        }
        lastError = `接口返回中未解析到模型列表 (${url})`
      }

      return {
        ok: false,
        models: [],
        message: lastError || '未获取到可用模型，请检查 Base URL 或手动填写模型名称'
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return {
        ok: false,
        models: [],
        message: msg.includes('aborted') ? '获取超时（12s），请检查网络或 Base URL' : msg
      }
    } finally {
      clearTimeout(timer)
    }
  },

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

      if (profile.provider === 'anthropic') {
        const payload = splitAnthropicMessages(request.messages)
        const response = await fetch(buildEndpoint(profile.baseUrl, '/messages'), {
          method: 'POST',
          signal: controller.signal,
          headers: buildHeaders(profile, true),
          body: JSON.stringify({
            model: profile.model,
            max_tokens: 8192,
            temperature,
            stream: true,
            ...(payload.system ? { system: payload.system } : {}),
            messages: payload.messages
          })
        })
        if (!response.ok) throw new Error(await readErrorMessage(response))
        if (!response.body) throw new Error('响应体为空')

        const contentType = response.headers.get('content-type') ?? ''
        if (contentType.includes('application/json') && !contentType.includes('text/event-stream')) {
          const text = extractAnthropicContent(await response.json())
          if (text) emit({ requestId: request.requestId, delta: text, done: false })
          emit({ requestId: request.requestId, done: true })
          return
        }

        let emitted = false
        await parseSseLines(response.body, (data) => {
          try {
            const parsed = JSON.parse(data) as { type?: string; delta?: { text?: string } }
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              emitted = true
              emit({ requestId: request.requestId, delta: parsed.delta.text, done: false })
            }
          } catch {
            // 忽略非 JSON 心跳行
          }
        })
        emit({
          requestId: request.requestId,
          done: true,
          ...(emitted ? {} : { error: '接口未返回任何内容，请检查模型名称或 Base URL' })
        })
        return
      }

      const response = await fetch(buildEndpoint(profile.baseUrl, '/chat/completions'), {
        method: 'POST',
        signal: controller.signal,
        headers: buildHeaders(profile, true),
        body: JSON.stringify({
          model: profile.model,
          messages: request.messages,
          temperature,
          stream: true
        })
      })
      if (!response.ok) throw new Error(await readErrorMessage(response))
      if (!response.body) throw new Error('响应体为空')

      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('application/json') && !contentType.includes('text/event-stream')) {
        const text = extractOpenAiContent(await response.json())
        if (text) emit({ requestId: request.requestId, delta: text, done: false })
        emit({
          requestId: request.requestId,
          done: true,
          ...(text ? {} : { error: '接口未返回任何内容，请检查模型名称或 Base URL' })
        })
        return
      }

      let emitted = false
      await parseSseLines(response.body, (data) => {
        if (data === '[DONE]') return
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string; reasoning_content?: string }; message?: { content?: string } }>
          }
          const choice = parsed.choices?.[0]
          const delta = choice?.delta?.content ?? choice?.delta?.reasoning_content ?? choice?.message?.content
          if (typeof delta === 'string' && delta) {
            emitted = true
            emit({ requestId: request.requestId, delta, done: false })
          }
        } catch {
          // 忽略非 JSON 心跳行
        }
      })
      emit({
        requestId: request.requestId,
        done: true,
        ...(emitted ? {} : { error: '接口未返回任何流式内容，请检查 Base URL 或模型是否支持对话' })
      })
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
