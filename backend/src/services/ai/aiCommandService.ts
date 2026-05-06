import { buildAiCommandContext } from './context'
import { createAiProvider } from './providerFactory'
import {
  createAiRequestId,
  getMessagePreview,
  logAiError,
  logAiInfo,
  logAiWarn,
  summarizeContext,
  summarizeRawResult,
  summarizeResult,
} from './logger'
import type { AiCommandContext, AiPage, AiParseResult } from './types'
import { validateAiParseResultWithDiagnostics } from './validation'

export class AiCommandValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiCommandValidationError'
  }
}

interface ParseCommandForUserInput {
  userId: number
  dataOwnerId: number
  body: {
    message: unknown
    page?: unknown
    currentNodeId?: unknown
  }
}

interface AiCommandProvider {
  name?: string
  parseCommand(request: { message: string; page: AiPage }, context: AiCommandContext): Promise<AiParseResult>
}

function normalizeMessage(value: unknown): string {
  if (typeof value !== 'string') {
    throw new AiCommandValidationError('请输入要解析的内容')
  }

  const trimmed = value.trim()
  if (!trimmed) {
    throw new AiCommandValidationError('请输入要解析的内容')
  }

  return trimmed
}

function normalizePage(value: unknown): AiPage {
  if (typeof value !== 'string') {
    return 'unknown'
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'timeline' || normalized === 'node-detail' || normalized === 'statistics' || normalized === 'settings') {
    return normalized
  }

  return 'unknown'
}

function normalizeCurrentNodeId(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function getTodayInShanghai(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export async function parseCommandForUser(input: ParseCommandForUserInput): Promise<AiParseResult> {
  const requestId = createAiRequestId()
  const message = normalizeMessage(input.body.message)
  const page = normalizePage(input.body.page)
  const currentNodeId = normalizeCurrentNodeId(input.body.currentNodeId)
  const today = getTodayInShanghai()

  logAiInfo('parse:start', {
    requestId,
    userId: input.userId,
    dataOwnerId: input.dataOwnerId,
    page,
    currentNodeId,
    messageLength: message.length,
    messagePreview: getMessagePreview(message),
  })

  const context = buildAiCommandContext({
    dataOwnerId: input.dataOwnerId,
    page,
    currentNodeId,
    today,
  })

  logAiInfo('parse:context', {
    requestId,
    ...summarizeContext(context),
  })

  let provider: AiCommandProvider | null = null
  const startedAt = Date.now()
  let rawResult: AiParseResult

  try {
    provider = createAiProvider() as unknown as AiCommandProvider
    rawResult = await provider.parseCommand({ message, page }, context)
  } catch (error) {
    logAiError('parse:error', {
      requestId,
      provider: provider?.name ?? process.env.AI_PROVIDER ?? 'openai',
      durationMs: Date.now() - startedAt,
      code: error && typeof error === 'object' && 'code' in error ? (error as { code?: unknown }).code : 'unknown',
      message: error instanceof Error ? error.message : 'Unknown AI parse error',
    })
    throw error
  }

  const durationMs = Date.now() - startedAt

  logAiInfo('parse:raw', {
    requestId,
    provider: provider.name ?? 'unknown',
    durationMs,
    ...summarizeRawResult(rawResult),
  })

  const validated = validateAiParseResultWithDiagnostics(rawResult, context)
  const validationSummary = {
    requestId,
    reason: validated.reason,
    ...summarizeResult(validated.result),
  }

  if (validated.result.status === 'unsupported') {
    logAiWarn('parse:validation', validationSummary)
  } else {
    logAiInfo('parse:validation', validationSummary)
  }

  return validated.result
}
