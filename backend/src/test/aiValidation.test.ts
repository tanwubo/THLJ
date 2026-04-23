import { describe, expect, it } from 'vitest'
import { validateAiParseResult } from '../services/ai/validation'
import type { AiCommandContext, AiParseResult } from '../services/ai/types'

const context: AiCommandContext = {
  today: '2026-04-23',
  page: 'timeline',
  currentNodeId: null,
  nodes: [
    {
      id: 13,
      name: '婚宴',
      todos: [
        { id: 91, content: '确认菜单' },
        { id: 92, content: '支付酒店定金' },
      ],
    },
    {
      id: 18,
      name: '婚纱照',
      todos: [{ id: 88, content: '选片' }],
    },
  ],
}

describe('validateAiParseResult', () => {
  it('accepts a ready create node draft with normalized deadline', () => {
    const result = validateAiParseResult({
      status: 'ready',
      draft: {
        actionType: 'create_node',
        fields: { name: '拍婚纱照', deadline: '2026-10-01' },
      },
      summary: '将新增节点：拍婚纱照，截止 2026-10-01',
      missingFields: [],
      candidates: {},
    }, context)

    expect(result).toEqual({
      status: 'ready',
      draft: {
        actionType: 'create_node',
        fields: { name: '拍婚纱照', deadline: '2026-10-01' },
      },
      summary: '将新增节点：拍婚纱照，截止 2026-10-01',
      missingFields: [],
      candidates: {},
    })
  })

  it('converts a missing node todo draft to needs_input with node candidates', () => {
    const result = validateAiParseResult({
      status: 'ready',
      draft: {
        actionType: 'create_todo',
        fields: { content: '确认菜单' },
      },
      summary: '识别到待办：确认菜单。请选择要添加到哪个节点。',
      missingFields: [],
      candidates: {},
    }, context)

    expect(result.status).toBe('needs_input')
    expect(result.missingFields).toEqual(['nodeId'])
    expect(result.candidates.nodes).toEqual([
      { id: 13, name: '婚宴' },
      { id: 18, name: '婚纱照' },
    ])
  })

  it('rejects invented nodeId values by requiring user selection', () => {
    const result = validateAiParseResult({
      status: 'ready',
      draft: {
        actionType: 'create_todo',
        fields: { nodeId: 999, content: '确认菜单' },
      },
      summary: '将在节点新增待办：确认菜单',
      missingFields: [],
      candidates: {},
    }, context)

    expect(result.status).toBe('needs_input')
    expect(result.missingFields).toEqual(['nodeId'])
    expect(result.draft?.fields).toEqual({ content: '确认菜单' })
  })

  it('converts an expense with only nodeId to needs_input with todos under that node', () => {
    const result = validateAiParseResult({
      status: 'ready',
      draft: {
        actionType: 'create_expense',
        fields: {
          nodeId: 13,
          nodeName: '婚宴',
          type: 'expense',
          amount: 5000,
          category: '婚宴',
          description: '定金',
        },
      },
      summary: '识别到一笔婚宴支出 ¥5000。请选择要挂到哪个待办。',
      missingFields: [],
      candidates: {},
    }, context)

    expect(result.status).toBe('needs_input')
    expect(result.missingFields).toEqual(['todoId'])
    expect(result.candidates.todos).toEqual([
      { id: 91, content: '确认菜单', nodeId: 13, nodeName: '婚宴' },
      { id: 92, content: '支付酒店定金', nodeId: 13, nodeName: '婚宴' },
    ])
  })

  it('falls back invalid expense categories to existing defaults', () => {
    const result = validateAiParseResult({
      status: 'ready',
      draft: {
        actionType: 'create_expense',
        fields: {
          todoId: 88,
          todoName: '选片',
          type: 'expense',
          amount: 3000,
          category: '摄影费用',
          description: '摄影费用',
        },
      },
      summary: '将在婚纱照 / 选片下记录支出：¥3000',
      missingFields: [],
      candidates: {},
    }, context)

    expect(result.status).toBe('ready')
    expect(result.draft?.fields.category).toBe('其他支出')
  })

  it('returns unsupported for unsupported action types', () => {
    const result = validateAiParseResult({
      status: 'ready',
      draft: {
        actionType: 'delete_node',
        fields: { name: '婚宴' },
      },
      summary: '暂不支持删除节点',
      missingFields: [],
      candidates: {},
    } as unknown as AiParseResult, context)

    expect(result).toEqual({
      status: 'unsupported',
      draft: null,
      summary: '暂不支持这个操作。当前只支持新增节点、待办和费用。',
      missingFields: [],
      candidates: {},
    })
  })
})
