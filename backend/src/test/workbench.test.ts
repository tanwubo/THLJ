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
    queryMock.mockImplementation((sql: string) => {
      if (sql === 'SELECT * FROM timeline_nodes WHERE id = ? AND user_id = ?') {
        return [{ id: 1 }]
      }
      if (sql === 'SELECT * FROM expense_records WHERE id = ?') {
        return [{ id: 101 }]
      }
      return []
    })
    runMock.mockResolvedValue({ lastInsertRowid: 101, changes: 1 })

    const { json, status, res } = createResponse()
    const req = {
      body: { nodeId: 1, type: 'expense', amount: 100, category: '婚宴' },
      user: { id: 99 },
    } as any

    await createExpense(req, res)

    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith({ error: 'todoId 为必填项' })
  })

  it('rejects attachment upload without todoId', async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql === 'SELECT * FROM timeline_nodes WHERE id = ? AND user_id = ?') {
        return [{ id: 1 }]
      }
      if (sql === 'SELECT * FROM attachments WHERE id = ?') {
        return [{ id: 201 }]
      }
      return []
    })
    runMock.mockResolvedValue({ lastInsertRowid: 201, changes: 1 })

    const { json, status, res } = createResponse()
    const req = {
      body: { nodeId: 1 },
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
  })
})
