import { describe, expect, it, vi } from 'vitest'

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
  it('posts parse commands to the AI endpoint', async () => {
    const { aiAPI } = await import('../services/api')
    postMock.mockResolvedValue({
      data: {
        status: 'ready',
        draft: { actionType: 'create_node', fields: { name: '拍婚纱照', deadline: '2026-10-01' } },
        summary: '将新增节点：拍婚纱照，截止 2026-10-01',
        missingFields: [],
        candidates: {},
      },
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
    expect(response.data.draft?.fields.name).toBe('拍婚纱照')
  })
})
