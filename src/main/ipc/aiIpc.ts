import { ipcMain } from 'electron'
import type { AiChatRequest, AiProfileInput } from '@shared/ai'
import { aiConfigStore } from '../services/aiConfigStore'
import { aiClientService } from '../services/aiClientService'
import { isTrustedSender } from './guard'

export function registerAiIpc(): void {
  ipcMain.handle('ai:get-config', (event) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return aiConfigStore.getPublicConfig()
  })

  ipcMain.handle('ai:save-profile', (event, input: AiProfileInput) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return aiConfigStore.saveProfile(input)
  })

  ipcMain.handle('ai:delete-profile', (event, id: string) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return aiConfigStore.deleteProfile(id)
  })

  ipcMain.handle('ai:set-default', (event, id: string | null) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return aiConfigStore.setDefault(id)
  })

  ipcMain.handle('ai:test-connection', (event, input: AiProfileInput) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return aiClientService.testConnection(input)
  })

  ipcMain.handle('ai:chat', (event, request: AiChatRequest) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return aiClientService.chat(request)
  })

  ipcMain.handle('ai:chat-stream', (event, request: AiChatRequest) => {
    if (!isTrustedSender(event)) throw new Error('来源不可信')
    return aiClientService.chatStream(request, (chunk) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('ai:stream-chunk', chunk)
      }
    })
  })

  ipcMain.handle('ai:abort', (event, requestId: string) => {
    if (!isTrustedSender(event)) return
    aiClientService.abort(requestId)
  })
}
