import type { AiCommandContext, AiParseResult } from './types'

export interface AiLogScope {
  requestId: string
  userId: number
  dataOwnerId: number
}

const MAX_MESSAGE_PREVIEW_LENGTH = 80

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`
}

function redactSecrets(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
}

export function createAiRequestId(): string {
  return `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function getMessagePreview(message: string): string {
  return truncate(redactSecrets(message), MAX_MESSAGE_PREVIEW_LENGTH)
}

export function summarizeContext(context: AiCommandContext) {
  const todoCount = context.nodes.reduce((count, node) => count + node.todos.length, 0)
  const currentNodeExists = context.currentNodeId !== null && context.nodes.some(node => node.id === context.currentNodeId)

  return {
    nodeCount: context.nodes.length,
    todoCount,
    currentNodeExists,
  }
}

export function summarizeRawResult(raw: AiParseResult) {
  const fields = raw.draft && typeof raw.draft.fields === 'object' && raw.draft.fields !== null ? raw.draft.fields : {}

  return {
    status: raw.status,
    actionType: raw.draft?.actionType ?? null,
    fieldKeys: Object.keys(fields).sort(),
  }
}

export function summarizeResult(result: AiParseResult) {
  return {
    status: result.status,
    actionType: result.draft?.actionType ?? null,
    missingFields: result.missingFields,
    candidateNodeCount: result.candidates.nodes?.length ?? 0,
    candidateTodoCount: result.candidates.todos?.length ?? 0,
  }
}

export function logAiInfo(event: string, details: Record<string, unknown>) {
  console.info(`[ai:${event}]`, details)
}

export function logAiWarn(event: string, details: Record<string, unknown>) {
  console.warn(`[ai:${event}]`, details)
}

export function logAiError(event: string, details: Record<string, unknown>) {
  console.error(`[ai:${event}]`, details)
}
