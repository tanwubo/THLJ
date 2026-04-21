import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyWorkbenchSchema } from '../db/init'
import { getProfile, register } from '../controllers/authController'
import {
  applyTimelineTemplate,
  createTimelineTemplate,
  deleteTimelineTemplate,
  listTimelineTemplates,
  updateTimelineTemplate,
} from '../controllers/timelineTemplateController'
import { ensureDefaultTimelineTemplateSeeded } from '../services/timelineTemplates'

vi.mock('../db', () => ({
  query: vi.fn(),
  run: vi.fn(),
  runInTransaction: vi.fn(),
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn(),
  },
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('signed-token'),
    verify: vi.fn(),
  },
}))

import { query, run, runInTransaction } from '../db'

const queryMock = query as unknown as ReturnType<typeof vi.fn>
const runMock = run as unknown as ReturnType<typeof vi.fn>
const runInTransactionMock = runInTransaction as unknown as ReturnType<typeof vi.fn>

describe('timeline template schema bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryMock.mockReset()
    runMock.mockReset()
    runInTransactionMock.mockReset()
  })

  it('creates timeline template tables', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const exec = vi.fn().mockReturnValue([])

    await applyWorkbenchSchema({ run, exec } as any)

    expect(
      run.mock.calls.some(([sql]) =>
        String(sql).includes('CREATE TABLE IF NOT EXISTS timeline_templates'),
      ),
    ).toBe(true)
    expect(
      run.mock.calls.some(([sql]) =>
        String(sql).includes('CREATE TABLE IF NOT EXISTS timeline_template_nodes'),
      ),
    ).toBe(true)
  })

  it('seeds the built-in template only when the template table is empty', async () => {
    queryMock.mockReturnValueOnce([])
    runMock.mockResolvedValueOnce({ lastInsertRowid: 7, changes: 1 })
    runInTransactionMock.mockResolvedValueOnce(undefined)

    await ensureDefaultTimelineTemplateSeeded()

    expect(queryMock).toHaveBeenCalledWith('SELECT id FROM timeline_templates LIMIT 1')
    expect(runMock).toHaveBeenCalledWith(
      'INSERT INTO timeline_templates (name, description, is_active) VALUES (?, ?, ?)',
      ['标准婚礼时间线', '覆盖婚礼筹备常见阶段，适合作为首次初始化模板。', 1],
    )
    expect(runInTransactionMock).toHaveBeenCalledTimes(1)
    expect(runInTransactionMock.mock.calls[0][0]).toHaveLength(9)

    queryMock.mockReset()
    runMock.mockReset()
    runInTransactionMock.mockReset()

    queryMock.mockReturnValueOnce([{ id: 99 }])

    await ensureDefaultTimelineTemplateSeeded()

    expect(runMock).not.toHaveBeenCalled()
    expect(runInTransactionMock).not.toHaveBeenCalled()
  })
})

describe('admin flag in auth payloads', () => {
  beforeEach(() => {
    process.env.ADMIN_USERNAMES = 'alice,root'
  })

  it('includes isAdmin in the register response for configured admin usernames', async () => {
    queryMock
      .mockReturnValueOnce([])
      .mockReturnValueOnce([])

    runMock
      .mockResolvedValueOnce({ lastInsertRowid: 11, changes: 1 })
      .mockResolvedValueOnce({ lastInsertRowid: 11, changes: 1 })

    const json = vi.fn()
    const status = vi.fn().mockReturnValue({ json })

    await register(
      {
        body: {
          username: 'alice',
          password: '123456',
          email: 'alice@example.com',
        },
      } as any,
      { status, json } as any,
    )

    expect(status).toHaveBeenCalledWith(201)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'signed-token',
        user: expect.objectContaining({
          username: 'alice',
          isAdmin: true,
        }),
      }),
    )
  })

  it('includes isAdmin in the profile response for configured admin usernames', async () => {
    queryMock
      .mockReturnValueOnce([
        {
          id: 11,
          username: 'alice',
          email: 'alice@example.com',
          invite_code: '998877',
          partner_id: null,
          created_at: '2026-04-21',
          last_login: '2026-04-21',
        },
      ])

    const json = vi.fn()

    await getProfile(
      {
        user: { id: 11 },
      } as any,
      { json, status: vi.fn().mockReturnValue({ json }) } as any,
    )

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'alice',
        isAdmin: true,
      }),
    )
  })
})

describe('timeline template endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryMock.mockReset()
    runMock.mockReset()
    runInTransactionMock.mockReset()
  })

  it('lists only active templates for non-admin users', async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM timeline_templates t')) {
        return [{ id: 1, name: '标准婚礼时间线', is_active: 1, node_count: 9 }]
      }

      return []
    })

    const json = vi.fn()

    await listTimelineTemplates(
      {
        query: {},
        user: { id: 2, username: 'guest' },
      } as any,
      { json } as any,
    )

    expect(json).toHaveBeenCalledWith({
      templates: [{ id: 1, name: '标准婚礼时间线', is_active: 1, node_count: 9 }],
    })
  })

  it('allows admins to replace a template and its nodes', async () => {
    process.env.ADMIN_USERNAMES = 'alice'
    queryMock.mockImplementation((sql: string, params: any[] = []) => {
      if (sql === 'SELECT * FROM timeline_templates WHERE id = ?') {
        expect(params).toEqual(['3'])
        return [{ id: 3, name: '旧模板', is_active: 1 }]
      }
      return []
    })
    runInTransactionMock.mockResolvedValueOnce(undefined)

    const json = vi.fn()

    await updateTimelineTemplate(
      {
        params: { id: '3' },
        user: { id: 1, username: 'alice' },
        body: {
          name: '新模板',
          description: '新的说明',
          isActive: true,
          nodes: [
            { name: '第一步', description: '说明 1' },
            { name: '第二步', description: '说明 2' },
          ],
        },
      } as any,
      { json, status: vi.fn().mockReturnValue({ json }) } as any,
    )

    expect(runInTransactionMock).toHaveBeenCalledTimes(1)
    expect(runInTransactionMock.mock.calls[0][0]).toEqual(
      expect.arrayContaining([
        {
          sql: 'UPDATE timeline_templates SET name = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          params: ['新模板', '新的说明', 1, '3'],
        },
        {
          sql: 'DELETE FROM timeline_template_nodes WHERE template_id = ?',
          params: ['3'],
        },
      ]),
    )
    expect(json).toHaveBeenCalledWith({ success: true })
  })

  it('allows admins to create and delete templates', async () => {
    process.env.ADMIN_USERNAMES = 'alice'
    runMock.mockResolvedValueOnce({ lastInsertRowid: 6, changes: 1 })
    runInTransactionMock.mockResolvedValue(undefined)

    const createJson = vi.fn()

    await createTimelineTemplate(
      {
        user: { id: 1, username: 'alice' },
        body: {
          name: '新模板',
          description: '新的模板说明',
          isActive: true,
          nodes: [
            { name: '第一步', description: '说明一' },
            { name: '第二步', description: '说明二' },
          ],
        },
        params: {},
      } as any,
      { json: createJson, status: vi.fn().mockReturnValue({ json: createJson }) } as any,
    )

    expect(runMock).toHaveBeenCalledWith(
      'INSERT INTO timeline_templates (name, description, is_active) VALUES (?, ?, ?)',
      ['新模板', '新的模板说明', 1],
    )
    expect(runInTransactionMock).toHaveBeenCalledWith([
      {
        sql: 'INSERT INTO timeline_template_nodes (template_id, name, description, "order") VALUES (?, ?, ?, ?)',
        params: [6, '第一步', '说明一', 1],
      },
      {
        sql: 'INSERT INTO timeline_template_nodes (template_id, name, description, "order") VALUES (?, ?, ?, ?)',
        params: [6, '第二步', '说明二', 2],
      },
    ])
    expect(createJson).toHaveBeenCalledWith({ success: true, id: 6 })

    const deleteJson = vi.fn()

    await deleteTimelineTemplate(
      {
        user: { id: 1, username: 'alice' },
        params: { id: '6' },
      } as any,
      { json: deleteJson, status: vi.fn().mockReturnValue({ json: deleteJson }) } as any,
    )

    expect(runInTransactionMock).toHaveBeenLastCalledWith([
      { sql: 'DELETE FROM timeline_template_nodes WHERE template_id = ?', params: ['6'] },
      { sql: 'DELETE FROM timeline_templates WHERE id = ?', params: ['6'] },
    ])
    expect(deleteJson).toHaveBeenCalledWith({ success: true })
  })

  it('applies a template only when the target timeline is empty', async () => {
    queryMock.mockImplementation((sql: string, params: any[] = []) => {
      if (sql === 'SELECT * FROM timeline_templates WHERE id = ?') {
        expect(params).toEqual([5])
        return [{ id: 5, name: '标准婚礼时间线', is_active: 1 }]
      }
      if (sql === 'SELECT * FROM timeline_template_nodes WHERE template_id = ? ORDER BY "order" ASC') {
        expect(params).toEqual([5])
        return [
          { id: 1, template_id: 5, name: '节点一', description: '说明一', order: 1 },
          { id: 2, template_id: 5, name: '节点二', description: '说明二', order: 2 },
        ]
      }
      if (sql === 'SELECT id FROM timeline_nodes WHERE user_id = ? LIMIT 1') {
        expect(params).toEqual([9])
        return []
      }
      return []
    })
    runInTransactionMock.mockResolvedValueOnce(undefined)

    const json = vi.fn()

    await applyTimelineTemplate(
      {
        body: { templateId: 5 },
        user: { id: 9, username: 'guest', dataOwnerId: 9 },
      } as any,
      { json, status: vi.fn().mockReturnValue({ json }) } as any,
    )

    expect(runInTransactionMock).toHaveBeenCalledTimes(1)
    expect(runInTransactionMock.mock.calls[0][0]).toHaveLength(2)
    expect(json).toHaveBeenCalledWith({ success: true })
  })

  it('rejects template application when the shared dataOwner timeline is already non-empty', async () => {
    queryMock.mockImplementation((sql: string, params: any[] = []) => {
      if (sql === 'SELECT * FROM timeline_templates WHERE id = ?') {
        expect(params).toEqual([5])
        return [{ id: 5, name: '标准婚礼时间线', is_active: 1 }]
      }
      if (sql === 'SELECT * FROM timeline_template_nodes WHERE template_id = ? ORDER BY "order" ASC') {
        expect(params).toEqual([5])
        return [{ id: 1, template_id: 5, name: '节点一', description: '说明一', order: 1 }]
      }
      if (sql === 'SELECT id FROM timeline_nodes WHERE user_id = ? LIMIT 1') {
        expect(params).toEqual([2])
        return [{ id: 88 }]
      }
      return []
    })

    const json = vi.fn()
    const status = vi.fn().mockReturnValue({ json })

    await applyTimelineTemplate(
      {
        body: { templateId: 5 },
        user: { id: 1, username: 'guest', dataOwnerId: 2 },
      } as any,
      { json, status } as any,
    )

    expect(runInTransactionMock).not.toHaveBeenCalled()
    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith({ error: '当前时间线已有数据，无法再次应用模板' })
  })
})
