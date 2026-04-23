import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAiCommandContext } from '../services/ai/context'
import { createAiProvider } from '../services/ai/providerFactory'
import { createOpenAiProvider } from '../services/ai/providers/openaiProvider'
import { createMiniMaxProvider } from '../services/ai/providers/minimaxProvider'

vi.mock('../db', () => ({ query: vi.fn() }))
import { query } from '../db'

const context = {
  today: '2026-04-23',
  page: 'timeline' as const,
  currentNodeId: null,
  nodes: [],
}

describe('AI context and providers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    delete process.env.AI_PROVIDER
    delete process.env.AI_MODEL
    delete process.env.AI_API_KEY
    delete process.env.AI_BASE_URL
    delete process.env.AI_TIMEOUT_MS
  })

  it('builds compact node and todo context for the data owner', () => {
    const queryMock = query as unknown as ReturnType<typeof vi.fn>
    queryMock.mockImplementation((sql: string, params: unknown[]) => {
      if (sql === 'SELECT id, name FROM timeline_nodes WHERE user_id = ? ORDER BY "order" ASC, id ASC') {
        expect(params).toEqual([99])
        return [
          { id: 13, name: '婚宴' },
          { id: 18, name: '婚纱照' },
        ]
      }
      if (sql === 'SELECT id, node_id, content FROM todo_items WHERE node_id IN (?,?) ORDER BY node_id ASC, created_at DESC') {
        expect(params).toEqual([13, 18])
        return [
          { id: 91, node_id: 13, content: '确认菜单' },
          { id: 88, node_id: 18, content: '选片' },
        ]
      }
      return []
    })

    expect(buildAiCommandContext({ dataOwnerId: 99, page: 'timeline', currentNodeId: null, today: '2026-04-23' })).toEqual({
      today: '2026-04-23',
      page: 'timeline',
      currentNodeId: null,
      nodes: [
        { id: 13, name: '婚宴', todos: [{ id: 91, content: '确认菜单' }] },
        { id: 18, name: '婚纱照', todos: [{ id: 88, content: '选片' }] },
      ],
    })
  })

  it('creates an OpenAI provider from environment variables', () => {
    process.env.AI_PROVIDER = 'openai'
    process.env.AI_MODEL = 'gpt-4.1-mini'
    process.env.AI_API_KEY = 'test-key'
    expect(createAiProvider().name).toBe('openai')
  })

  it('creates a MiniMax provider from environment variables', () => {
    process.env.AI_PROVIDER = 'minimax'
    process.env.AI_MODEL = 'MiniMax-M1'
    process.env.AI_API_KEY = 'test-key'
    process.env.AI_BASE_URL = 'https://api.minimax.io/v1'
    expect(createAiProvider().name).toBe('minimax')
  })

  it('maps OpenAI structured output text to an AI parse result', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  status: 'ready',
                  draft: { actionType: 'create_node', fields: { name: '拍婚纱照', deadline: '2026-10-01' } },
                  summary: '将新增节点：拍婚纱照，截止 2026-10-01',
                  missingFields: [],
                  candidates: {},
                }),
              },
            ],
          },
        ],
      }),
    })
    const provider = createOpenAiProvider({
      apiKey: 'test-key',
      model: 'gpt-4.1-mini',
      baseUrl: 'https://api.openai.com/v1',
      timeoutMs: 15000,
      fetchImpl: fetchMock,
    })
    const result = await provider.parseCommand({ message: '增加一个10月1日拍婚纱照的节点', page: 'timeline' }, context)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    )
    expect(result.draft?.fields.name).toBe('拍婚纱照')
  })

  it('maps MiniMax chat completion content to an AI parse result', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                status: 'ready',
                draft: { actionType: 'create_node', fields: { name: '拍婚纱照', deadline: '2026-10-01' } },
                summary: '将新增节点：拍婚纱照，截止 2026-10-01',
                missingFields: [],
                candidates: {},
              }),
            },
          },
        ],
      }),
    })
    const provider = createMiniMaxProvider({
      apiKey: 'test-key',
      model: 'MiniMax-M1',
      baseUrl: 'https://api.minimax.io/v1',
      timeoutMs: 15000,
      fetchImpl: fetchMock,
    })
    const result = await provider.parseCommand({ message: '增加一个10月1日拍婚纱照的节点', page: 'timeline' }, context)
    expect(fetchMock).toHaveBeenCalledWith('https://api.minimax.io/v1/chat/completions', expect.objectContaining({ method: 'POST' }))
    expect(result.summary).toContain('拍婚纱照')
  })
})
