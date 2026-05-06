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

  it('logs AI parse checkpoints and unsupported validation reasons without leaking secrets', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const queryMock = query as unknown as ReturnType<typeof vi.fn>
    queryMock.mockImplementation((sql: string) => {
      if (sql === 'SELECT id, name FROM timeline_nodes WHERE user_id = ? ORDER BY "order" ASC, id ASC') {
        return [{ id: 13, name: '婚宴' }]
      }
      if (sql === 'SELECT id, node_id, content FROM todo_items WHERE node_id IN (?) ORDER BY node_id ASC, created_at DESC') {
        return [{ id: 91, node_id: 13, content: '确认菜单' }]
      }
      return []
    })

    const provider = {
      name: 'openai',
      parseCommand: vi.fn().mockResolvedValue({
        status: 'ready',
        draft: {
          actionType: 'create_node',
          fields: { deadline: '2026-10-01' },
        },
        summary: '将新增节点',
        missingFields: [],
        candidates: {},
      }),
    }
    ;(createAiProvider as unknown as ReturnType<typeof vi.fn>).mockReturnValue(provider)

    const result = await parseCommandForUser({
      userId: 1,
      dataOwnerId: 99,
      body: { message: '增加一个10月1日拍婚纱照的节点 sk-test-secret', page: 'timeline', currentNodeId: null },
    })

    expect(result.status).toBe('unsupported')
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ai:parse:start]'),
      expect.objectContaining({
        requestId: expect.any(String),
        userId: 1,
        dataOwnerId: 99,
        page: 'timeline',
        currentNodeId: null,
        messageLength: expect.any(Number),
        messagePreview: expect.stringContaining('增加一个10月1日拍婚纱照的节点'),
      }),
    )
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ai:parse:context]'),
      expect.objectContaining({
        nodeCount: 1,
        todoCount: 1,
        currentNodeExists: false,
      }),
    )
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ai:parse:raw]'),
      expect.objectContaining({
        provider: 'openai',
        status: 'ready',
        actionType: 'create_node',
        fieldKeys: ['deadline'],
      }),
    )
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ai:parse:validation]'),
      expect.objectContaining({
        status: 'unsupported',
        reason: 'create_node_missing_name',
      }),
    )
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain('sk-test-secret')
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('sk-test-secret')
  })

  it('returns 400 for blank message', async () => {
    const json = vi.fn()
    const status = vi.fn().mockReturnValue({ json })

    await parseAiCommand({ body: { message: '   ', page: 'timeline' }, user: { id: 1, dataOwnerId: 99 } } as any, { json, status } as any)

    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith({ error: '请输入要解析的内容' })
  })

  it('maps provider configuration errors to friendly 503 responses', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    ;(createAiProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw Object.assign(new Error('AI_API_KEY 未配置'), { code: 'config' })
    })

    const json = vi.fn()
    const status = vi.fn().mockReturnValue({ json })

    await parseAiCommand({ body: { message: '增加节点', page: 'timeline' }, user: { id: 1, dataOwnerId: 99 } } as any, { json, status } as any)

    expect(status).toHaveBeenCalledWith(503)
    expect(json).toHaveBeenCalledWith({ error: 'AI 服务暂不可用，请稍后再试' })
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ai:parse:error]'),
      expect.objectContaining({
        code: 'config',
        message: 'AI_API_KEY 未配置',
        requestId: expect.any(String),
      }),
    )
  })
})
