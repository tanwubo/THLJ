import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNode, getNodeWorkbench, getTimeline, updateNode } from '../controllers/timelineController'
import { deleteTodo } from '../controllers/todoController'

// Mock the db module
vi.mock('../db', () => ({
  query: vi.fn(),
  run: vi.fn(),
  runInTransaction: vi.fn(),
}))

import { query, run, runInTransaction } from '../db'

// Import the functions to test (we'll test the logic)
describe('Timeline Controller Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('DEFAULT_NODES constant', () => {
    it('should have 9 default nodes', () => {
      const DEFAULT_NODES = [
        { name: '确定结婚意向', order: 1 },
        { name: '双方父母见面', order: 2 },
        { name: '男方上门提亲', order: 3 },
        { name: '彩礼嫁妆三金协商', order: 4 },
        { name: '订婚仪式', order: 5 },
        { name: '婚前筹备', order: 6 },
        { name: '民政局领证', order: 7 },
        { name: '婚礼举办', order: 8 },
        { name: '婚后费用结算收尾', order: 9 },
      ]
      expect(DEFAULT_NODES.length).toBe(9)
    })

    it('should have correct order sequence', () => {
      const DEFAULT_NODES = [
        { name: '确定结婚意向', order: 1 },
        { name: '双方父母见面', order: 2 },
        { name: '男方上门提亲', order: 3 },
        { name: '彩礼嫁妆三金协商', order: 4 },
        { name: '订婚仪式', order: 5 },
        { name: '婚前筹备', order: 6 },
        { name: '民政局领证', order: 7 },
        { name: '婚礼举办', order: 8 },
        { name: '婚后费用结算收尾', order: 9 },
      ]
      for (let i = 0; i < DEFAULT_NODES.length; i++) {
        expect(DEFAULT_NODES[i].order).toBe(i + 1)
      }
    })
  })

  describe('Progress calculation', () => {
    it('should calculate 0% progress when no todos', () => {
      const todos: any[] = []
      const completed = todos.filter((t: any) => t.status === 'completed').length
      const progress = todos.length > 0 ? Math.round((completed / todos.length) * 100) : 0
      expect(progress).toBe(0)
    })

    it('should calculate 100% progress when all todos completed', () => {
      const todos = [
        { id: 1, status: 'completed' },
        { id: 2, status: 'completed' },
      ]
      const completed = todos.filter((t: any) => t.status === 'completed').length
      const progress = todos.length > 0 ? Math.round((completed / todos.length) * 100) : 0
      expect(progress).toBe(100)
    })

    it('should calculate 50% progress when half todos completed', () => {
      const todos = [
        { id: 1, status: 'completed' },
        { id: 2, status: 'pending' },
      ]
      const completed = todos.filter((t: any) => t.status === 'completed').length
      const progress = todos.length > 0 ? Math.round((completed / todos.length) * 100) : 0
      expect(progress).toBe(50)
    })

    it('should round progress to nearest integer', () => {
      const todos = [
        { id: 1, status: 'completed' },
        { id: 2, status: 'pending' },
        { id: 3, status: 'pending' },
      ]
      const completed = todos.filter((t: any) => t.status === 'completed').length
      const progress = todos.length > 0 ? Math.round((completed / todos.length) * 100) : 0
      expect(progress).toBe(33) // 33.33... rounded
    })
  })

  describe('Overall progress calculation', () => {
    it('should calculate overall progress as average of node progress', () => {
      const nodes = [
        { id: 1, progress: 100 },
        { id: 2, progress: 50 },
        { id: 3, progress: 0 },
      ]
      const totalProgress = nodes.reduce((sum: number, n: any) => sum + (n.progress || 0), 0)
      const overallProgress = nodes.length > 0 ? Math.round(totalProgress / nodes.length) : 0
      expect(overallProgress).toBe(50)
    })

    it('should return 0 when no nodes', () => {
      const nodes: any[] = []
      const totalProgress = nodes.reduce((sum: number, n: any) => sum + (n.progress || 0), 0)
      const overallProgress = nodes.length > 0 ? Math.round(totalProgress / nodes.length) : 0
      expect(overallProgress).toBe(0)
    })
  })

  describe('empty timeline behavior', () => {
    it('returns an empty timeline instead of auto-seeding default nodes', async () => {
      const queryMock = query as unknown as ReturnType<typeof vi.fn>
      const runMock = run as unknown as ReturnType<typeof vi.fn>

      queryMock.mockImplementation((sql: string) => {
        if (sql === 'SELECT * FROM timeline_nodes WHERE user_id = ? ORDER BY CASE WHEN deadline IS NULL THEN 1 ELSE 0 END ASC, deadline ASC, "order" ASC') {
          return []
        }

        return []
      })

      const json = vi.fn()
      const res = { json, status: vi.fn().mockReturnValue({ json }) } as any

      await getTimeline({ user: { id: 1, dataOwnerId: 1 } } as any, res)

      expect(json).toHaveBeenCalledWith({ nodes: [], overallProgress: 0 })
      expect(runMock).not.toHaveBeenCalled()
    })
  })

  describe('timeline node persistence', () => {
    it('creates nodes with budget and treats empty budget as 0', async () => {
      const queryMock = query as unknown as ReturnType<typeof vi.fn>
      const runMock = run as unknown as ReturnType<typeof vi.fn>

      queryMock.mockImplementation((sql: string, params: any[] = []) => {
        if (sql === 'SELECT MAX("order") as max FROM timeline_nodes WHERE user_id = ?') {
          expect(params).toEqual([1])
          return [{ max: 2 }]
        }
        if (sql === 'SELECT * FROM timeline_nodes WHERE id = ?') {
          expect(params).toEqual([11])
          return [{ id: 11, name: '婚礼筹备', budget: 0 }]
        }
        return []
      })
      runMock.mockResolvedValue({ lastInsertRowid: 11, changes: 1 })

      const json = vi.fn()
      const res = { json, status: vi.fn().mockReturnValue({ json }) } as any

      await createNode({
        body: { name: '婚礼筹备', description: '筹备预算', deadline: '2026-05-01', budget: '' },
        user: { id: 1, dataOwnerId: 1 },
      } as any, res)

      expect(runMock).toHaveBeenCalledWith(
        'INSERT INTO timeline_nodes (user_id, name, description, deadline, budget, "order", status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [1, '婚礼筹备', '筹备预算', '2026-05-01', 0, 3, 'pending']
      )
      expect(json).toHaveBeenCalledWith({ id: 11, name: '婚礼筹备', budget: 0 })
    })

    it.each([
      ['negative string', '-1'],
      ['boolean true', true],
      ['boolean false', false],
      ['array', []],
    ])('rejects invalid node budget values: %s', async (_label, budget) => {
      const queryMock = query as unknown as ReturnType<typeof vi.fn>
      const runMock = run as unknown as ReturnType<typeof vi.fn>

      const json = vi.fn()
      const status = vi.fn().mockReturnValue({ json })
      const res = { json, status } as any

      await createNode({
        body: { name: '婚礼筹备', budget },
        user: { id: 1, dataOwnerId: 1 },
      } as any, res)

      expect(status).toHaveBeenCalledWith(400)
      expect(json).toHaveBeenCalledWith({ error: '预算必须是大于等于 0 的数字' })
      expect(queryMock).not.toHaveBeenCalled()
      expect(runMock).not.toHaveBeenCalled()
    })

    it.each([
      ['null', null],
      ['number', 123],
      ['object', { text: '婚礼筹备' }],
      ['blank string', '   '],
    ])('rejects invalid create node name payloads: %s', async (_label, name) => {
      const queryMock = query as unknown as ReturnType<typeof vi.fn>
      const runMock = run as unknown as ReturnType<typeof vi.fn>

      const json = vi.fn()
      const status = vi.fn().mockReturnValue({ json })
      const res = { json, status } as any

      await createNode({
        body: { name, budget: 1000 },
        user: { id: 1, dataOwnerId: 1 },
      } as any, res)

      expect(status).toHaveBeenCalledWith(400)
      expect(json).toHaveBeenCalledWith({ error: '节点名称不能为空' })
      expect(queryMock).not.toHaveBeenCalled()
      expect(runMock).not.toHaveBeenCalled()
    })

    it('updates node budget', async () => {
      const queryMock = query as unknown as ReturnType<typeof vi.fn>
      const runMock = run as unknown as ReturnType<typeof vi.fn>

      queryMock.mockImplementation((sql: string, params: any[] = []) => {
        if (sql === 'SELECT * FROM timeline_nodes WHERE id = ? AND user_id = ?') {
          expect(params).toEqual(['5', 1])
          return [{ id: 5, user_id: 1 }]
        }
        if (sql === 'SELECT * FROM timeline_nodes WHERE id = ?') {
          expect(params).toEqual(['5'])
          return [{ id: 5, budget: 9000 }]
        }
        return []
      })
      runMock.mockResolvedValue({ changes: 1 })

      const json = vi.fn()
      const res = { json, status: vi.fn().mockReturnValue({ json }) } as any

      await updateNode({
        params: { id: '5' },
        body: { budget: 9000 },
        user: { id: 1, dataOwnerId: 1 },
      } as any, res)

      expect(runMock).toHaveBeenCalledWith(
        'UPDATE timeline_nodes SET budget = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
        [9000, '5', 1]
      )
      expect(json).toHaveBeenCalledWith({ id: 5, budget: 9000 })
    })

    it.each([
      ['null', null],
      ['number', 123],
      ['object', { text: '婚礼筹备' }],
      ['blank string', '   '],
    ])('rejects invalid update node name payloads: %s', async (_label, name) => {
      const queryMock = query as unknown as ReturnType<typeof vi.fn>
      const runMock = run as unknown as ReturnType<typeof vi.fn>

      queryMock.mockImplementation((sql: string, params: any[] = []) => {
        if (sql === 'SELECT * FROM timeline_nodes WHERE id = ? AND user_id = ?') {
          expect(params).toEqual(['5', 1])
          return [{ id: 5, user_id: 1 }]
        }
        return []
      })

      const json = vi.fn()
      const status = vi.fn().mockReturnValue({ json })
      const res = { json, status } as any

      await updateNode({
        params: { id: '5' },
        body: { name },
        user: { id: 1, dataOwnerId: 1 },
      } as any, res)

      expect(status).toHaveBeenCalledWith(400)
      expect(json).toHaveBeenCalledWith({ error: '节点名称不能为空' })
      expect(runMock).not.toHaveBeenCalled()
    })

    it('returns node budgets in the timeline payload', async () => {
      const queryMock = query as unknown as ReturnType<typeof vi.fn>
      queryMock.mockImplementation((sql: string) => {
        if (sql === 'SELECT * FROM timeline_nodes WHERE user_id = ? ORDER BY CASE WHEN deadline IS NULL THEN 1 ELSE 0 END ASC, deadline ASC, "order" ASC') {
          return [{ id: 1, budget: 12000, order: 1 }]
        }
        if (sql === 'SELECT * FROM todo_items WHERE node_id = ?') {
          return []
        }
        return []
      })

      const json = vi.fn()
      const res = { json, status: vi.fn().mockReturnValue({ json }) } as any

      await getTimeline({ user: { id: 1, dataOwnerId: 1 } } as any, res)

      expect(json).toHaveBeenCalledWith({
        nodes: [{ id: 1, budget: 12000, order: 1, progress: 0, todos: [] }],
        overallProgress: 0,
      })
    })
  })

  describe('timeline ordering', () => {
    it('sorts nodes by deadline first, no deadline last, and order as tiebreaker', async () => {
      const queryMock = query as unknown as ReturnType<typeof vi.fn>
      queryMock.mockImplementation((sql: string) => {
        if (sql === 'SELECT * FROM timeline_nodes WHERE user_id = ? ORDER BY CASE WHEN deadline IS NULL THEN 1 ELSE 0 END ASC, deadline ASC, "order" ASC') {
          return []
        }
        return []
      })

      const json = vi.fn()
      const res = { json, status: vi.fn().mockReturnValue({ json }) } as any

      await getTimeline({ user: { id: 1, dataOwnerId: 1 } } as any, res)

      expect(queryMock).toHaveBeenCalledWith(
        'SELECT * FROM timeline_nodes WHERE user_id = ? ORDER BY CASE WHEN deadline IS NULL THEN 1 ELSE 0 END ASC, deadline ASC, "order" ASC',
        [1]
      )
    })
  })
})

describe('Expense Categories', () => {
  it('should have correct income categories', () => {
    const EXPENSE_CATEGORIES = {
      income: ['彩礼', '礼金', '嫁妆回礼', '其他收入'],
      expense: ['婚宴', '婚庆', '婚车', '婚纱摄影', '三金/五金', '酒店预订', '婚车车队', '蜜月旅行', '其他支出'],
    }
    expect(EXPENSE_CATEGORIES.income).toContain('彩礼')
    expect(EXPENSE_CATEGORIES.income).toContain('礼金')
    expect(EXPENSE_CATEGORIES.expense).toContain('婚宴')
    expect(EXPENSE_CATEGORIES.expense).toContain('婚庆')
  })

  it('should have unique categories', () => {
    const EXPENSE_CATEGORIES = {
      income: ['彩礼', '礼金', '嫁妆回礼', '其他收入'],
      expense: ['婚宴', '婚庆', '婚车', '婚纱摄影', '三金/五金', '酒店预订', '婚车车队', '蜜月旅行', '其他支出'],
    }
    const allCategories = [...EXPENSE_CATEGORIES.income, ...EXPENSE_CATEGORIES.expense]
    const uniqueCategories = new Set(allCategories)
    expect(uniqueCategories.size).toBe(allCategories.length)
  })
})

describe('Todo Status Types', () => {
  it('should have valid status values', () => {
    const validStatuses = ['pending', 'completed', 'cancelled']
    expect(validStatuses).toContain('pending')
    expect(validStatuses).toContain('completed')
    expect(validStatuses).toContain('cancelled')
  })
})

describe('Node Status Types', () => {
  it('should have valid status values', () => {
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled']
    expect(validStatuses).toContain('pending')
    expect(validStatuses).toContain('in_progress')
    expect(validStatuses).toContain('completed')
    expect(validStatuses).toContain('cancelled')
  })
})

describe('Workbench aggregation', () => {
  const queryMock = query as unknown as ReturnType<typeof vi.fn>

  function createResponse() {
    const json = vi.fn()
    const status = vi.fn().mockReturnValue({ json })
    return { json, status, res: { json, status } as any }
  }

  function resetQueryMock() {
    queryMock.mockReset()
  }

  function mockWorkbenchQueries({
    nodeRows,
    todoRows,
    expenseRows = [],
    attachmentRows = [],
    legacyExpenseRows = [],
    legacyAttachmentRows = [],
    memoRows = [],
  }: {
    nodeRows: any[]
    todoRows: any[]
    expenseRows?: any[]
    attachmentRows?: any[]
    legacyExpenseRows?: any[]
    legacyAttachmentRows?: any[]
    memoRows?: any[]
  }) {
    queryMock.mockImplementation((sql: string, params: any[] = []) => {
      if (sql === 'SELECT * FROM timeline_nodes WHERE id = ? AND user_id = ?') {
        return nodeRows
      }
      if (sql === 'SELECT * FROM todo_items WHERE node_id = ? ORDER BY CASE WHEN deadline IS NULL THEN 1 ELSE 0 END ASC, deadline ASC, created_at DESC') {
        return todoRows
      }
      if (sql === 'SELECT * FROM expense_records WHERE node_id = ? AND todo_id IS NULL ORDER BY created_at DESC') {
        expect(params).toEqual(['1'])
        return legacyExpenseRows
      }
      if (sql === 'SELECT * FROM attachments WHERE node_id = ? AND todo_id IS NULL ORDER BY created_at DESC') {
        expect(params).toEqual(['1'])
        return legacyAttachmentRows
      }
      if (sql.startsWith('SELECT * FROM expense_records WHERE todo_id IN (')) {
        expect(params).toEqual(todoRows.map(todo => todo.id))
        return expenseRows
      }
      if (sql.startsWith('SELECT * FROM attachments WHERE todo_id IN (')) {
        expect(params).toEqual(todoRows.map(todo => todo.id))
        return attachmentRows
      }
      if (sql === 'SELECT * FROM memos WHERE node_id = ? ORDER BY updated_at DESC LIMIT 1') {
        return memoRows
      }
      return []
    })
  }

  it('returns 404 when the node is missing and keeps the lookup scoped by user_id', async () => {
    resetQueryMock()
    mockWorkbenchQueries({
      nodeRows: [],
      todoRows: [],
    })

    const { json, status, res } = createResponse()
    const req = { params: { id: '1' }, user: { id: 99 } } as any

    await getNodeWorkbench(req, res)

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryMock).toHaveBeenCalledWith(
      'SELECT * FROM timeline_nodes WHERE id = ? AND user_id = ?',
      ['1', 99]
    )
    expect(status).toHaveBeenCalledWith(404)
    expect(json).toHaveBeenCalledWith({ error: '节点不存在' })
  })

  it('sorts workbench todos by deadline first and created_at descending as tiebreaker', async () => {
    resetQueryMock()
    mockWorkbenchQueries({
      nodeRows: [{ id: 1, name: '确定结婚意向', status: 'pending' }],
      todoRows: [],
    })

    const { res } = createResponse()
    const req = { params: { id: '1' }, user: { id: 99 } } as any

    await getNodeWorkbench(req, res)

    expect(queryMock).toHaveBeenCalledWith(
      'SELECT * FROM todo_items WHERE node_id = ? ORDER BY CASE WHEN deadline IS NULL THEN 1 ELSE 0 END ASC, deadline ASC, created_at DESC',
      ['1']
    )
  })

  it('returns an empty workbench when the node has no todos or memo', async () => {
    resetQueryMock()
    mockWorkbenchQueries({
      nodeRows: [{ id: 1, name: '确定结婚意向', status: 'pending' }],
      todoRows: [],
      memoRows: [],
    })

    const { json, res } = createResponse()
    const req = { params: { id: '1' }, user: { id: 99 } } as any

    await getNodeWorkbench(req, res)

    const payload = json.mock.calls[0][0]

    expect(payload.node).toEqual({ id: 1, name: '确定结婚意向', status: 'pending' })
    expect(payload.todos).toEqual([])
    expect(payload.memo).toBeNull()
    expect(queryMock).toHaveBeenCalledWith(
      'SELECT * FROM expense_records WHERE node_id = ? AND todo_id IS NULL ORDER BY created_at DESC',
      ['1']
    )
    expect(queryMock).toHaveBeenCalledWith(
      'SELECT * FROM attachments WHERE node_id = ? AND todo_id IS NULL ORDER BY created_at DESC',
      ['1']
    )
  })

  it('includes legacy node-level expenses and attachments in the workbench response', async () => {
    resetQueryMock()
    mockWorkbenchQueries({
      nodeRows: [{ id: 1, name: '确定结婚意向', status: 'pending' }],
      todoRows: [{ id: 11, node_id: 1, content: '沟通彩礼金额' }],
      legacyExpenseRows: [{ id: 51, node_id: 1, todo_id: null, amount: 999 }],
      legacyAttachmentRows: [{ id: 61, node_id: 1, todo_id: null, file_name: 'legacy.pdf' }],
    })

    const { json, res } = createResponse()
    const req = { params: { id: '1' }, user: { id: 99 } } as any

    await getNodeWorkbench(req, res)

    const payload = json.mock.calls[0][0]
    expect(payload.node.expenses).toEqual([{ id: 51, node_id: 1, todo_id: null, amount: 999 }])
    expect(payload.node.attachments).toEqual([{ id: 61, node_id: 1, todo_id: null, file_name: 'legacy.pdf' }])
  })

  it('returns grouped todos and uses the todo_id IN (...) path for child records', async () => {
    resetQueryMock()
    mockWorkbenchQueries({
      nodeRows: [{ id: 1, name: '确定结婚意向', status: 'pending' }],
      todoRows: [
        { id: 11, node_id: 1, content: '沟通彩礼金额' },
        { id: 12, node_id: 1, content: '确认婚期' },
      ],
      expenseRows: [
        { id: 21, todo_id: 11, amount: 5200 },
        { id: 22, todo_id: 12, amount: 3000 },
      ],
      attachmentRows: [
        { id: 31, todo_id: 11, file_name: '报价单.pdf' },
        { id: 32, todo_id: 12, file_name: '日期表.xlsx' },
      ],
      memoRows: [{ id: 41, node_id: 1, content: 'memo' }],
    })

    const { json, res } = createResponse()
    const req = { params: { id: '1' }, user: { id: 99 } } as any

    await getNodeWorkbench(req, res)

    const payload = json.mock.calls[0][0]
    const expenseQuery = queryMock.mock.calls.find(([sql]) => String(sql).startsWith('SELECT * FROM expense_records WHERE todo_id IN ('))
    const attachmentQuery = queryMock.mock.calls.find(([sql]) => String(sql).startsWith('SELECT * FROM attachments WHERE todo_id IN ('))

    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      'SELECT * FROM timeline_nodes WHERE id = ? AND user_id = ?',
      ['1', 99]
    )
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      'SELECT * FROM todo_items WHERE node_id = ? ORDER BY CASE WHEN deadline IS NULL THEN 1 ELSE 0 END ASC, deadline ASC, created_at DESC',
      ['1']
    )
    expect(expenseQuery?.[1]).toEqual([11, 12])
    expect(attachmentQuery?.[1]).toEqual([11, 12])
    expect(payload.todos).toHaveLength(2)
    expect(payload.todos[0].id).toBe(11)
    expect(payload.todos[0].expenses).toEqual([{ id: 21, todo_id: 11, amount: 5200 }])
    expect(payload.todos[0].attachments).toEqual([{ id: 31, todo_id: 11, file_name: '报价单.pdf' }])
    expect(payload.todos[1].id).toBe(12)
    expect(payload.todos[1].expenses).toEqual([{ id: 22, todo_id: 12, amount: 3000 }])
    expect(payload.todos[1].attachments).toEqual([{ id: 32, todo_id: 12, file_name: '日期表.xlsx' }])
    expect(payload.memo).toEqual({ id: 41, node_id: 1, content: 'memo' })
    expect(payload.node.expenses).toBeUndefined()
    expect(payload.node.attachments).toBeUndefined()
  })
})

describe('Todo deletion', () => {
  const queryMock = query as unknown as ReturnType<typeof vi.fn>
  const runInTransactionMock = runInTransaction as unknown as ReturnType<typeof vi.fn>

  function createResponse() {
    const json = vi.fn()
    const status = vi.fn().mockReturnValue({ json })
    return { json, status, res: { json, status } as any }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    queryMock.mockReset()
    runInTransactionMock.mockReset()
  })

  it('deletes todo-linked expenses and attachments atomically when deleting a todo', async () => {
    queryMock.mockImplementation((sql: string, params: any[] = []) => {
      if (sql === 'SELECT * FROM todo_items t JOIN timeline_nodes n ON t.node_id = n.id WHERE t.id = ? AND n.user_id = ?') {
        expect(params).toEqual(['7', 99])
        return [{ id: 7, node_id: 1 }]
      }
      return []
    })

    const { json, res } = createResponse()
    const req = { params: { id: '7' }, user: { id: 99 } } as any

    await deleteTodo(req, res)

    expect(runInTransactionMock).toHaveBeenCalledTimes(1)
    expect(runInTransactionMock).toHaveBeenCalledWith([
      { sql: 'DELETE FROM attachments WHERE todo_id = ?', params: ['7'] },
      { sql: 'DELETE FROM expense_records WHERE todo_id = ?', params: ['7'] },
      { sql: 'DELETE FROM todo_items WHERE id = ?', params: ['7'] },
    ])
    expect(json).toHaveBeenCalledWith({ success: true })
  })

  it('returns 404 and skips cascade deletes when the todo does not belong to the user', async () => {
    queryMock.mockImplementation((sql: string, params: any[] = []) => {
      if (sql === 'SELECT * FROM todo_items t JOIN timeline_nodes n ON t.node_id = n.id WHERE t.id = ? AND n.user_id = ?') {
        expect(params).toEqual(['7', 99])
        return []
      }
      return []
    })

    const { json, status, res } = createResponse()
    const req = { params: { id: '7' }, user: { id: 99 } } as any

    await deleteTodo(req, res)

    expect(runInTransactionMock).not.toHaveBeenCalled()
    expect(status).toHaveBeenCalledWith(404)
    expect(json).toHaveBeenCalledWith({ error: '待办不存在' })
  })
})
