import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => ({
  query: vi.fn(),
  run: vi.fn(),
  runInTransaction: vi.fn(),
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}))

import jwt from 'jsonwebtoken'
import { query } from '../db'
import { authMiddleware } from '../middleware/auth'
import { createSocketAuthMiddleware } from '../socket'
import { getTimeline } from '../controllers/timelineController'

const queryMock = query as unknown as ReturnType<typeof vi.fn>
const jwtVerifyMock = jwt.verify as ReturnType<typeof vi.fn>

function createResponse() {
  const json = vi.fn()
  const status = vi.fn().mockReturnValue({ json })
  return { json, status, res: { json, status } as any }
}

describe('partnership data access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryMock.mockReset()
    jwtVerifyMock.mockReset()
  })

  it('auth middleware refreshes partner state from the database instead of trusting stale JWT claims', () => {
    jwtVerifyMock.mockReturnValue({ id: 1, username: 'alice', partnerId: null })
    queryMock.mockImplementation((sql: string, params: any[] = []) => {
      if (sql === 'SELECT id, username, partner_id, data_owner_id FROM users WHERE id = ?') {
        expect(params).toEqual([1])
        return [{ id: 1, username: 'alice', partner_id: 2, data_owner_id: 2 }]
      }
      return []
    })

    const req = {
      headers: {
        authorization: 'Bearer stale-token',
      },
    } as any
    const { res } = createResponse()
    const next = vi.fn()

    authMiddleware(req, res, next)

    expect(req.user).toEqual({
      id: 1,
      username: 'alice',
      partnerId: 2,
      dataOwnerId: 2,
    })
    expect(next).toHaveBeenCalledWith()
  })

  it('socket auth middleware joins realtime with the current partner relationship from the database', () => {
    jwtVerifyMock.mockReturnValue({ id: 1, username: 'alice', partnerId: null })
    queryMock.mockImplementation((sql: string, params: any[] = []) => {
      if (sql === 'SELECT id, username, partner_id, data_owner_id FROM users WHERE id = ?') {
        expect(params).toEqual([1])
        return [{ id: 1, username: 'alice', partner_id: 8, data_owner_id: 8 }]
      }
      return []
    })

    const socket: any = {
      handshake: { auth: { token: 'stale-token' } },
      data: {},
    }
    const next = vi.fn()

    createSocketAuthMiddleware(socket as any, next)

    expect(socket.data.user).toEqual({
      id: 1,
      username: 'alice',
      partnerId: 8,
      dataOwnerId: 8,
    })
    expect(next).toHaveBeenCalledWith()
  })

  it('timeline reads shared data from data_owner_id after users bind', async () => {
    queryMock.mockImplementation((sql: string, params: any[] = []) => {
      if (sql === 'SELECT id, username, partner_id, data_owner_id FROM users WHERE id = ?') {
        expect(params).toEqual([1])
        return [{ id: 1, username: 'alice', partner_id: 2, data_owner_id: 2 }]
      }
      if (sql === 'SELECT * FROM timeline_nodes WHERE user_id = ? ORDER BY "order" ASC') {
        expect(params).toEqual([2])
        return [{ id: 10, user_id: 2, name: '婚前筹备', order: 1, status: 'pending' }]
      }
      if (sql === 'SELECT * FROM todo_items WHERE node_id = ?') {
        expect(params).toEqual([10])
        return [{ id: 20, node_id: 10, status: 'completed' }]
      }
      return []
    })

    const { json, res } = createResponse()
    const req = { user: { id: 1, username: 'alice', dataOwnerId: 2 } } as any

    await getTimeline(req, res)

    expect(queryMock).toHaveBeenCalledWith(
      'SELECT * FROM timeline_nodes WHERE user_id = ? ORDER BY "order" ASC',
      [2],
    )
    expect(json).toHaveBeenCalledWith({
      nodes: [
        {
          id: 10,
          user_id: 2,
          name: '婚前筹备',
          order: 1,
          status: 'pending',
          progress: 100,
          todos: [{ id: 20, node_id: 10, status: 'completed' }],
        },
      ],
      overallProgress: 100,
    })
  })
})
