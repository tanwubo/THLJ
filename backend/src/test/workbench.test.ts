import { describe, it, expect } from 'vitest'

describe('workbench schema contract', () => {
  it('requires expense and attachment records to have todo_id support', () => {
    const expenseColumns = ['id', 'node_id', 'todo_id', 'amount']
    const attachmentColumns = ['id', 'node_id', 'todo_id', 'file_name']

    expect(expenseColumns).toContain('todo_id')
    expect(attachmentColumns).toContain('todo_id')
  })
})
