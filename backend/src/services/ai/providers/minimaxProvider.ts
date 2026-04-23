import type { AiCommandContext, AiParseResult, AiPage, AiProvider, AiParseRequest } from '../types'
import { AiProviderError } from './openaiProvider'

interface MiniMaxProviderOptions {
  apiKey: string
  model: string
  baseUrl: string
  timeoutMs: number
  fetchImpl?: typeof fetch
}

export interface MiniMaxProvider extends AiProvider {
  name: 'minimax'
  parseCommand(request: { message: string; page: AiPage }, context: AiCommandContext): Promise<AiParseResult>
  parse(request: AiParseRequest): Promise<AiParseResult>
}

function buildSystemPrompt(context: AiCommandContext): string {
  return [
    '你是一个中文 AI 指令解析器。只返回一个严格 JSON 对象，不要返回 Markdown、解释、代码块或额外文本。',
    `今天：${context.today}`,
    `当前页面：${context.page}`,
    `当前节点 ID：${context.currentNodeId === null ? 'null' : context.currentNodeId}`,
    '支持的动作：create_node, create_todo, create_expense。',
    '不要编造不存在的节点 ID、待办 ID 或其他主键。',
    `可用上下文：${JSON.stringify(context.nodes)}`,
  ].join('\n')
}

function extractText(payload: any): string | null {
  const text = payload?.choices?.[0]?.message?.content
  return typeof text === 'string' && text.trim() ? text : null
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) {
    return null
  }

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < text.length; index += 1) {
    const char = text[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
    } else if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return text.slice(start, index + 1)
      }
    }
  }

  return null
}

async function readJsonResponse(response: Response): Promise<any> {
  try {
    return await response.json()
  } catch (error) {
    throw new AiProviderError('AI 响应格式错误', 'malformed', error)
  }
}

export function createMiniMaxProvider(options: MiniMaxProviderOptions): MiniMaxProvider {
  const fetchImpl = options.fetchImpl ?? fetch

  async function parseCommand(request: { message: string; page: AiPage }, context: AiCommandContext): Promise<AiParseResult> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs)

    try {
      const response = await fetchImpl(`${options.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          messages: [
            { role: 'system', content: buildSystemPrompt(context) },
            { role: 'user', content: `${request.message}\n\n请只返回一个严格 JSON 对象。` },
          ],
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new AiProviderError('AI 请求失败', 'network', { status: response.status })
      }

      const payload = await readJsonResponse(response)
      const text = extractText(payload)
      if (!text) {
        throw new AiProviderError('AI 响应缺少文本内容', 'malformed', payload)
      }

      const jsonText = extractFirstJsonObject(text)
      if (!jsonText) {
        throw new AiProviderError('AI 响应缺少 JSON 对象', 'malformed', text)
      }

      try {
        return JSON.parse(jsonText) as AiParseResult
      } catch (error) {
        throw new AiProviderError('AI 响应 JSON 无法解析', 'malformed', error)
      }
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw error
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiProviderError('AI 请求超时', 'timeout', error)
      }

      throw new AiProviderError('AI 请求失败', 'network', error)
    } finally {
      clearTimeout(timeout)
    }
  }

  return {
    name: 'minimax',
    parseCommand,
    parse(request: AiParseRequest) {
      return parseCommand({ message: request.message, page: request.context.page }, request.context)
    },
  }
}
