import type { AiProvider } from './types'
import { createMiniMaxProvider } from './providers/minimaxProvider'
import { createOpenAiProvider } from './providers/openaiProvider'
import { AiProviderError } from './providers/openaiProvider'

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

function getTimeoutMs(value: string | undefined): number {
  const parsed = value ? Number(value) : 15000
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15000
}

export function createAiProvider(): AiProvider & { name: 'openai' | 'minimax' } {
  const providerName = (process.env.AI_PROVIDER ?? 'openai').toLowerCase()
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) {
    throw new AiProviderError('AI_API_KEY 未配置', 'config')
  }

  const timeoutMs = getTimeoutMs(process.env.AI_TIMEOUT_MS)

  if (providerName === 'openai') {
    return createOpenAiProvider({
      apiKey,
      model: process.env.AI_MODEL ?? 'gpt-4.1-mini',
      baseUrl: normalizeBaseUrl(process.env.AI_BASE_URL ?? 'https://api.openai.com/v1'),
      timeoutMs,
    })
  }

  if (providerName === 'minimax') {
    return createMiniMaxProvider({
      apiKey,
      model: process.env.AI_MODEL ?? 'MiniMax-M1',
      baseUrl: normalizeBaseUrl(process.env.AI_BASE_URL ?? 'https://api.minimax.io/v1'),
      timeoutMs,
    })
  }

  throw new AiProviderError(`不支持的 AI_PROVIDER: ${process.env.AI_PROVIDER ?? ''}`, 'config')
}
