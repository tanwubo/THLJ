import initSqlJs from 'sql.js'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyWorkbenchSchema } from '../db/init'
import { createExpense } from '../controllers/expenseController'
import { uploadAttachment } from '../controllers/attachmentController'

vi.mock('../db', () => ({
  query: vi.fn(),
  run: vi.fn(),
}))

vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    mkdir: vi.fn(),
    rename: vi.fn(),
    unlink: vi.fn(),
  },
}))

import { query, run } from '../db'

describe('workbench schema contract', () => {
  it('adds todo_id support to expense and attachment tables', async () => {
    const SQL = await initSqlJs({
      locateFile: file => `node_modules/sql.js/dist/${file}`,
    })
    const db = new SQL.Database()

    db.exec(`
      CREATE TABLE expense_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await applyWorkbenchSchema({
      exec: sql => db.exec(sql),
      run: sql => db.run(sql),
    })
    const firstExpenseColumns = db.exec('PRAGMA table_info(expense_records)')[0]?.values.map((row: any[]) => row[1]) ?? []
    const firstAttachmentColumns = db.exec('PRAGMA table_info(attachments)')[0]?.values.map((row: any[]) => row[1]) ?? []
    const firstExpenseIndexes = db.exec('PRAGMA index_list(expense_records)')[0]?.values.map((row: any[]) => row[1]) ?? []
    const firstAttachmentIndexes = db.exec('PRAGMA index_list(attachments)')[0]?.values.map((row: any[]) => row[1]) ?? []

    await applyWorkbenchSchema({
      exec: sql => db.exec(sql),
      run: sql => db.run(sql),
    })

    const expenseColumns = db.exec('PRAGMA table_info(expense_records)')[0]?.values.map((row: any[]) => row[1]) ?? []
    const attachmentColumns = db.exec('PRAGMA table_info(attachments)')[0]?.values.map((row: any[]) => row[1]) ?? []
    const expenseIndexes = db.exec('PRAGMA index_list(expense_records)')[0]?.values.map((row: any[]) => row[1]) ?? []
    const attachmentIndexes = db.exec('PRAGMA index_list(attachments)')[0]?.values.map((row: any[]) => row[1]) ?? []

    expect(expenseColumns).toEqual(firstExpenseColumns)
    expect(attachmentColumns).toEqual(firstAttachmentColumns)
    expect(expenseIndexes).toEqual(firstExpenseIndexes)
    expect(attachmentIndexes).toEqual(firstAttachmentIndexes)
    expect(expenseColumns).toContain('todo_id')
    expect(attachmentColumns).toContain('todo_id')
    expect(expenseIndexes).toContain('idx_expense_records_todo_id')
    expect(attachmentIndexes).toContain('idx_attachments_todo_id')
  })
})

describe('Workbench validation', () => {
  const queryMock = query as unknown as ReturnType<typeof vi.fn>
  const runMock = run as unknown as ReturnType<typeof vi.fn>

  function createResponse() {
    const json = vi.fn()
    const status = vi.fn().mockReturnValue({ json })
    return { json, status, res: { json, status } as any }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    queryMock.mockReset()
    runMock.mockReset()
  })

  it('rejects expense creation without todoId', async () => {
    const { json, status, res } = createResponse()
    const req = {
      body: { type: 'expense', amount: 100, category: '婚宴' },
      user: { id: 99 },
    } as any

    await createExpense(req, res)

    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith({ error: 'todoId 为必填项' })
    expect(queryMock).not.toHaveBeenCalled()
    expect(runMock).not.toHaveBeenCalled()
  })

  it('rejects malformed expense todoId', async () => {
    const { json, status, res } = createResponse()
    const req = {
      body: { todoId: 'abc', type: 'expense', amount: 100, category: '婚宴' },
      user: { id: 99 },
    } as any

    await createExpense(req, res)

    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith({ error: 'todoId 必须是有效的正整数' })
    expect(queryMock).not.toHaveBeenCalled()
    expect(runMock).not.toHaveBeenCalled()
  })

  it('rejects expense creation for nonexistent or unowned todo', async () => {
    queryMock.mockReturnValue([])

    const { json, status, res } = createResponse()
    const req = {
      body: { todoId: 7, type: 'expense', amount: 100, category: '婚宴' },
      user: { id: 99 },
    } as any

    await createExpense(req, res)

    expect(queryMock).toHaveBeenCalledWith(
      'SELECT t.* FROM todo_items t JOIN timeline_nodes n ON t.node_id = n.id WHERE t.id = ? AND n.user_id = ?',
      [7, 99]
    )
    expect(status).toHaveBeenCalledWith(404)
    expect(json).toHaveBeenCalledWith({ error: '待办不存在' })
    expect(runMock).not.toHaveBeenCalled()
  })

  it('stores todo_id when creating an expense', async () => {
    queryMock.mockImplementation((sql: string, params: any[] = []) => {
      if (sql === 'SELECT t.* FROM todo_items t JOIN timeline_nodes n ON t.node_id = n.id WHERE t.id = ? AND n.user_id = ?') {
        expect(params).toEqual([7, 99])
        return [{ id: 7, node_id: 1 }]
      }
      if (sql === 'SELECT * FROM expense_records WHERE id = ?') {
        expect(params).toEqual([101])
        return [{ id: 101, todo_id: 7 }]
      }
      return []
    })
    runMock.mockResolvedValue({ lastInsertRowid: 101, changes: 1 })

    const { json, res } = createResponse()
    const req = {
      body: { todoId: 7, type: 'expense', amount: 100, category: '婚宴', description: '订金' },
      user: { id: 99 },
    } as any

    await createExpense(req, res)

    expect(runMock).toHaveBeenCalledWith(
      'INSERT INTO expense_records (node_id, todo_id, user_id, type, amount, category, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [1, 7, 99, 'expense', 100, '婚宴', '订金']
    )
    expect(json).toHaveBeenCalledWith({ id: 101, todo_id: 7 })
  })

  it('rejects attachment upload without todoId', async () => {
    const { json, status, res } = createResponse()
    const req = {
      body: {},
      file: {
        path: 'C:\\temp\\upload.tmp',
        originalname: 'quote.pdf',
        size: 1024,
        mimetype: 'application/pdf',
      },
      user: { id: 99 },
    } as any

    await uploadAttachment(req, res)

    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith({ error: 'todoId 为必填项' })
    expect(queryMock).not.toHaveBeenCalled()
    expect(runMock).not.toHaveBeenCalled()
  })

  it('rejects attachment upload for nonexistent or unowned todo', async () => {
    queryMock.mockReturnValue([])

    const { json, status, res } = createResponse()
    const req = {
      body: { todoId: 7 },
      file: {
        path: 'C:\\temp\\upload.tmp',
        originalname: 'quote.pdf',
        size: 1024,
        mimetype: 'application/pdf',
      },
      user: { id: 99 },
    } as any

    await uploadAttachment(req, res)

    expect(queryMock).toHaveBeenCalledWith(
      'SELECT t.* FROM todo_items t JOIN timeline_nodes n ON t.node_id = n.id WHERE t.id = ? AND n.user_id = ?',
      [7, 99]
    )
    expect(status).toHaveBeenCalledWith(404)
    expect(json).toHaveBeenCalledWith({ error: '待办不存在' })
    expect(runMock).not.toHaveBeenCalled()
  })

  it('stores todo_id when uploading an attachment', async () => {
    queryMock.mockImplementation((sql: string, params: any[] = []) => {
      if (sql === 'SELECT t.* FROM todo_items t JOIN timeline_nodes n ON t.node_id = n.id WHERE t.id = ? AND n.user_id = ?') {
        expect(params).toEqual([7, 99])
        return [{ id: 7, node_id: 1 }]
      }
      if (sql === 'SELECT * FROM attachments WHERE id = ?') {
        expect(params).toEqual([201])
        return [{ id: 201, todo_id: 7 }]
      }
      return []
    })
    runMock.mockResolvedValue({ lastInsertRowid: 201, changes: 1 })

    const { json, res } = createResponse()
    const req = {
      body: { todoId: 7 },
      file: {
        path: 'C:\\temp\\upload.tmp',
        originalname: 'quote.pdf',
        size: 1024,
        mimetype: 'application/pdf',
      },
      user: { id: 99 },
    } as any

    await uploadAttachment(req, res)

    expect(runMock).toHaveBeenCalledWith(
      'INSERT INTO attachments (node_id, todo_id, user_id, file_name, file_path, file_size, file_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [1, 7, 99, 'quote.pdf', expect.stringMatching(/^\/uploads\/\d+-quote\.pdf$/), 1024, 'application/pdf']
    )
    expect(json).toHaveBeenCalledWith({ id: 201, todo_id: 7 })
  })
})
