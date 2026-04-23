import { buildAiCommandContext } from './context'
import { createAiProvider } from './providerFactory'
import type { AiCommandContext, AiPage, AiParseResult } from './types'
import { validateAiParseResult } from './validation'

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
  const message = normalizeMessage(input.body.message)
  const page = normalizePage(input.body.page)
  const currentNodeId = normalizeCurrentNodeId(input.body.currentNodeId)
  const today = getTodayInShanghai()
  const context = buildAiCommandContext({
    dataOwnerId: input.dataOwnerId,
    page,
    currentNodeId,
    today,
  })

  const provider = createAiProvider() as unknown as AiCommandProvider
  const rawResult = await provider.parseCommand({ message, page }, context)
  return validateAiParseResult(rawResult, context)
}
