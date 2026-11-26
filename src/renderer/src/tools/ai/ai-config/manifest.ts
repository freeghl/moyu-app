import type { ToolManifest } from '@shared/types'

export const manifest: ToolManifest = {
  id: 'ai-config',
  name: 'AI 模型配置',
  description: '统一管理 OpenAI、DeepSeek、Claude、Ollama 等模型，供所有插件与工具共享调用',
  icon: '🤖',
  category: 'ai',
  keywords: ['ai', 'llm', 'openai', 'deepseek', 'claude', 'ollama', 'api', 'key', '模型', '配置'],
  component: () => import('./index.vue')
}

export default manifest
