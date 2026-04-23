import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiParseCommandResponse } from '../services/api'

const postMock = vi.fn()

vi.mock('axios', () => ({
  default: {
    create: () => ({
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      post: postMock,
    }),
  },
}))

describe('aiAPI', () => {
  beforeEach(() => {
    postMock.mockReset()
    vi.resetModules()
  })

  it('posts parse commands to the AI endpoint', async () => {
    const { aiAPI } = await import('../services/api')
    const mockedResponse: AiParseCommandResponse = {
      status: 'needs_input',
      draft: null,
      summary: '需要选择目标节点',
      missingFields: ['nodeId'],
      candidates: {
        nodes: [{ id: 1, name: '婚礼筹备' }],
        todos: [{ id: 7, content: '确认摄影档期', nodeId: 1, nodeName: '婚礼筹备' }],
      },
    }
    postMock.mockResolvedValue({
      data: mockedResponse,
    })

    const response = await aiAPI.parseCommand({
      message: '增加一个10月1日拍婚纱照的节点',
      page: 'timeline',
      currentNodeId: null,
    })

    expect(postMock).toHaveBeenCalledWith('/ai/parse-command', {
      message: '增加一个10月1日拍婚纱照的节点',
      page: 'timeline',
      currentNodeId: null,
    })
    expect(response.data.draft?.fields.name).toBeUndefined()
    expect(response.data.candidates.todos?.[0].nodeName).toBe('婚礼筹备')
  })
})
