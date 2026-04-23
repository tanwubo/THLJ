import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { AiProviderError } from '../services/ai/providers/openaiProvider'
import { AiCommandValidationError, parseCommandForUser } from '../services/ai/aiCommandService'

function isProviderAvailabilityError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const code = (error as { code?: unknown }).code
  return (
    error instanceof AiProviderError ||
    code === 'config' ||
    code === 'timeout' ||
    code === 'network' ||
    code === 'malformed'
  )
}

export async function parseAiCommand(req: AuthRequest, res: Response) {
  const userId = req.user?.id
  const dataOwnerId = req.user?.dataOwnerId ?? userId

  if (typeof userId !== 'number' || !Number.isInteger(userId) || userId <= 0 || typeof dataOwnerId !== 'number' || !Number.isInteger(dataOwnerId) || dataOwnerId <= 0) {
    return res.status(401).json({ error: '未授权访问，请先登录' })
  }

  try {
    const result = await parseCommandForUser({
      userId,
      dataOwnerId,
      body: req.body ?? {},
    })

    return res.json(result)
  } catch (error) {
    if (error instanceof AiCommandValidationError) {
      return res.status(400).json({ error: error.message })
    }

    if (isProviderAvailabilityError(error)) {
      return res.status(503).json({ error: 'AI 服务暂不可用，请稍后再试' })
    }

    console.error('AI 指令解析失败:', error)
    return res.status(500).json({ error: 'AI 指令解析失败' })
  }
}
