import type { AiCommandContext, AiParseResult, AiPage, AiProvider, AiParseRequest } from '../types'

export class AiProviderError extends Error {
  code: string
  details?: unknown

  constructor(message: string, code: string, details?: unknown) {
    super(message)
    this.name = 'AiProviderError'
    this.code = code
    this.details = details
  }
}

interface OpenAiProviderOptions {
  apiKey: string
  model: string
  baseUrl: string
  timeoutMs: number
  fetchImpl?: typeof fetch
}

export interface OpenAiProvider extends AiProvider {
  name: 'openai'
  parseCommand(request: { message: string; page: AiPage }, context: AiCommandContext): Promise<AiParseResult>
  parse(request: AiParseRequest): Promise<AiParseResult>
}

function buildSystemPrompt(context: AiCommandContext): string {
  return [
    '你是一个中文 AI 指令解析器，只能输出 JSON。',
    `今天：${context.today}`,
    `当前页面：${context.page}`,
    `当前节点 ID：${context.currentNodeId === null ? 'null' : context.currentNodeId}`,
    '支持的动作：create_node, create_todo, create_expense。',
    '不要编造不存在的节点 ID、待办 ID 或其他主键。',
    `可用上下文：${JSON.stringify(context.nodes)}`,
  ].join('\n')
}

function extractText(payload: any): string | null {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text
  }

  if (!Array.isArray(payload?.output)) {
    return null
  }

  for (const outputItem of payload.output) {
    if (!Array.isArray(outputItem?.content)) {
      continue
    }

    const contentText = outputItem.content.find((item: any) => typeof item?.text === 'string' && item.text.trim())?.text
    if (typeof contentText === 'string') {
      return contentText
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

export function createOpenAiProvider(options: OpenAiProviderOptions): OpenAiProvider {
  const fetchImpl = options.fetchImpl ?? fetch

  async function parseCommand(request: { message: string; page: AiPage }, context: AiCommandContext): Promise<AiParseResult> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs)

    try {
      const response = await fetchImpl(`${options.baseUrl.replace(/\/+$/, '')}/responses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          input: [
            { role: 'system', content: [{ type: 'input_text', text: buildSystemPrompt(context) }] },
            { role: 'user', content: [{ type: 'input_text', text: request.message }] },
          ],
          text: { format: { type: 'json_object' } },
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

      try {
        return JSON.parse(text) as AiParseResult
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
    name: 'openai',
    parseCommand,
    parse(request: AiParseRequest) {
      return parseCommand({ message: request.message, page: request.context.page }, request.context)
    },
  }
}
