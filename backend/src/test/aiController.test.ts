import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseAiCommand } from '../controllers/aiController'
import { parseCommandForUser } from '../services/ai/aiCommandService'

vi.mock('../db', () => ({ query: vi.fn(), run: vi.fn() }))
vi.mock('../services/ai/providerFactory', () => ({ createAiProvider: vi.fn() }))

import { query, run } from '../db'
import { createAiProvider } from '../services/ai/providerFactory'

describe('AI parse endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-23T08:00:00.000Z'))
  })

  it('returns a validated ready draft and does not write data', async () => {
    const queryMock = query as unknown as ReturnType<typeof vi.fn>
    queryMock.mockImplementation((sql: string, params: unknown[]) => {
      if (sql === 'SELECT id, name FROM timeline_nodes WHERE user_id = ? ORDER BY "order" ASC, id ASC') {
        expect(params).toEqual([99])
        return [{ id: 13, name: '婚宴' }]
      }
      if (sql === 'SELECT id, node_id, content FROM todo_items WHERE node_id IN (?) ORDER BY node_id ASC, created_at DESC') {
        expect(params).toEqual([13])
        return [{ id: 91, node_id: 13, content: '确认菜单' }]
      }
      return []
    })

    const provider = {
      parseCommand: vi.fn().mockResolvedValue({
        status: 'ready',
        draft: {
          actionType: 'create_todo',
          fields: {
            nodeId: 13,
            nodeName: '婚宴',
            content: '确认菜单',
            deadline: '2026-09-20',
          },
        },
        summary: '将在婚宴节点新增待办：确认菜单，截止 2026-09-20',
        missingFields: [],
        candidates: {},
      }),
    }
    ;(createAiProvider as unknown as ReturnType<typeof vi.fn>).mockReturnValue(provider)

    const result = await parseCommandForUser({
      userId: 1,
      dataOwnerId: 99,
      body: { message: '给婚宴节点增加一个9月20日前确认菜单的待办', page: 'timeline', currentNodeId: null },
    })

    expect(result.status).toBe('ready')
    expect(result.draft?.fields.nodeId).toBe(13)
    expect(provider.parseCommand).toHaveBeenCalledWith(
      { message: '给婚宴节点增加一个9月20日前确认菜单的待办', page: 'timeline' },
      expect.objectContaining({
        today: '2026-04-23',
        page: 'timeline',
        currentNodeId: null,
        nodes: [{ id: 13, name: '婚宴', todos: [{ id: 91, content: '确认菜单' }] }],
      }),
    )
    expect(run).not.toHaveBeenCalled()
  })

  it('returns 400 for blank message', async () => {
    const json = vi.fn()
    const status = vi.fn().mockReturnValue({ json })

    await parseAiCommand({ body: { message: '   ', page: 'timeline' }, user: { id: 1, dataOwnerId: 99 } } as any, { json, status } as any)

    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith({ error: '请输入要解析的内容' })
  })

  it('maps provider configuration errors to friendly 503 responses', async () => {
    ;(createAiProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw Object.assign(new Error('AI_API_KEY 未配置'), { code: 'config' })
    })

    const json = vi.fn()
    const status = vi.fn().mockReturnValue({ json })

    await parseAiCommand({ body: { message: '增加节点', page: 'timeline' }, user: { id: 1, dataOwnerId: 99 } } as any, { json, status } as any)

    expect(status).toHaveBeenCalledWith(503)
    expect(json).toHaveBeenCalledWith({ error: 'AI 服务暂不可用，请稍后再试' })
  })
})
