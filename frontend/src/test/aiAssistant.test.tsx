import { describe, expect, it, vi } from 'vitest'
import type { AiParseCommandResponse } from '../services/api'
import { confirmAiDraft } from '../components/ai/aiDraftActions'

describe('confirmAiDraft', () => {
  it('creates a node from a ready node draft', async () => {
    const timelineAPI = { createNode: vi.fn().mockResolvedValue({}) }
    const todoAPI = { createTodo: vi.fn() }
    const expenseAPI = { createExpense: vi.fn() }
    const emitRealtimeEvent = vi.fn()

    await confirmAiDraft({
      result: {
        status: 'ready',
        draft: {
          actionType: 'create_node',
          fields: { name: '拍婚纱照', deadline: '2026-10-01' },
        },
        summary: '将新增节点：拍婚纱照，截止 2026-10-01',
        missingFields: [],
        candidates: {},
      },
      timelineAPI,
      todoAPI,
      expenseAPI,
      emitRealtimeEvent,
    })

    expect(timelineAPI.createNode).toHaveBeenCalledWith({
      name: '拍婚纱照',
      deadline: '2026-10-01',
    })
    expect(emitRealtimeEvent).toHaveBeenCalledWith('node_update', 'created')
  })

  it('creates a todo from a ready todo draft', async () => {
    const timelineAPI = { createNode: vi.fn() }
    const todoAPI = { createTodo: vi.fn().mockResolvedValue({}) }
    const expenseAPI = { createExpense: vi.fn() }
    const emitRealtimeEvent = vi.fn()

    await confirmAiDraft({
      result: {
        status: 'ready',
        draft: {
          actionType: 'create_todo',
          fields: { nodeId: 13, content: '确认菜单', deadline: '2026-09-20' },
        },
        summary: '将在婚宴节点新增待办：确认菜单，截止 2026-09-20',
        missingFields: [],
        candidates: {},
      },
      timelineAPI,
      todoAPI,
      expenseAPI,
      emitRealtimeEvent,
    })

    expect(todoAPI.createTodo).toHaveBeenCalledWith({
      nodeId: 13,
      content: '确认菜单',
      deadline: '2026-09-20',
    })
    expect(emitRealtimeEvent).toHaveBeenCalledWith('todo_update', 'created', {
      nodeId: 13,
    })
  })

  it('creates an expense from a ready expense draft', async () => {
    const timelineAPI = { createNode: vi.fn() }
    const todoAPI = { createTodo: vi.fn() }
    const expenseAPI = { createExpense: vi.fn().mockResolvedValue({}) }
    const emitRealtimeEvent = vi.fn()

    await confirmAiDraft({
      result: {
        status: 'ready',
        draft: {
          actionType: 'create_expense',
          fields: {
            todoId: 88,
            type: 'expense',
            amount: 3000,
            category: '婚纱摄影',
            description: '摄影费用',
          },
        },
        summary: '将在婚纱照 / 选片下记录支出：¥3000，分类：婚纱摄影',
        missingFields: [],
        candidates: {},
      },
      timelineAPI,
      todoAPI,
      expenseAPI,
      emitRealtimeEvent,
    })

    expect(expenseAPI.createExpense).toHaveBeenCalledWith({
      todoId: 88,
      type: 'expense',
      amount: 3000,
      category: '婚纱摄影',
      description: '摄影费用',
    })
    expect(emitRealtimeEvent).toHaveBeenCalledWith('expense_update', 'created', {
      todoId: 88,
    })
  })

  it('rejects a ready expense draft with zero amount', async () => {
    const timelineAPI = { createNode: vi.fn() }
    const todoAPI = { createTodo: vi.fn() }
    const expenseAPI = { createExpense: vi.fn() }

    await expect(
      confirmAiDraft({
        result: {
          status: 'ready',
          draft: {
            actionType: 'create_expense',
            fields: {
              todoId: 88,
              type: 'expense',
              amount: 0,
              category: '婚纱摄影',
              description: '摄影费用',
            },
          },
          summary: '将在婚纱照 / 选片下记录支出：¥0，分类：婚纱摄影',
          missingFields: [],
          candidates: {},
        },
        timelineAPI,
        todoAPI,
        expenseAPI,
        emitRealtimeEvent: vi.fn(),
      })
    ).rejects.toThrow('费用信息不完整')
    expect(expenseAPI.createExpense).not.toHaveBeenCalled()
  })

  it('rejects a ready node draft with blank name', async () => {
    const timelineAPI = { createNode: vi.fn() }
    const todoAPI = { createTodo: vi.fn() }
    const expenseAPI = { createExpense: vi.fn() }

    await expect(
      confirmAiDraft({
        result: {
          status: 'ready',
          draft: {
            actionType: 'create_node',
            fields: { name: '   ', deadline: '2026-10-01' },
          },
          summary: '将新增节点：   ，截止 2026-10-01',
          missingFields: [],
          candidates: {},
        },
        timelineAPI,
        todoAPI,
        expenseAPI,
        emitRealtimeEvent: vi.fn(),
      })
    ).rejects.toThrow('节点名称不能为空')
    expect(timelineAPI.createNode).not.toHaveBeenCalled()
  })

  it('rejects a ready todo draft with blank content', async () => {
    const timelineAPI = { createNode: vi.fn() }
    const todoAPI = { createTodo: vi.fn() }
    const expenseAPI = { createExpense: vi.fn() }

    await expect(
      confirmAiDraft({
        result: {
          status: 'ready',
          draft: {
            actionType: 'create_todo',
            fields: { nodeId: 13, content: '   ', deadline: '2026-09-20' },
          },
          summary: '将在婚宴节点新增待办：   ，截止 2026-09-20',
          missingFields: [],
          candidates: {},
        },
        timelineAPI,
        todoAPI,
        expenseAPI,
        emitRealtimeEvent: vi.fn(),
      })
    ).rejects.toThrow('待办信息不完整')
    expect(todoAPI.createTodo).not.toHaveBeenCalled()
  })

  it('rejects drafts that are not ready', async () => {
    const result: AiParseCommandResponse = {
      status: 'needs_input',
      draft: {
        actionType: 'create_todo',
        fields: { content: '确认菜单' },
      },
      summary: '请选择节点',
      missingFields: ['nodeId'],
      candidates: { nodes: [{ id: 13, name: '婚宴' }] },
    }

    await expect(
      confirmAiDraft({
        result,
        timelineAPI: { createNode: vi.fn() },
        todoAPI: { createTodo: vi.fn() },
        expenseAPI: { createExpense: vi.fn() },
        emitRealtimeEvent: vi.fn(),
      })
    ).rejects.toThrow('请先补全信息')
  })
})
