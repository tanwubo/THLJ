import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}))

import jwt from 'jsonwebtoken'
import {
  createSocketAuthMiddleware,
  createSocketEventRegistrar,
} from '../socket'

describe('socket authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts a valid token and stores the authenticated user on the socket', () => {
    ;(jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 7,
      username: 'alice',
      partnerId: 8,
    })

    const socket = {
      handshake: { auth: { token: 'valid-token' } },
      data: {} as { user?: { id: number; username: string; partnerId: number } },
    }
    const next = vi.fn()

    createSocketAuthMiddleware(socket as any, next)

    expect(socket.data.user).toEqual({
      id: 7,
      username: 'alice',
      partnerId: 8,
    })
    expect(next).toHaveBeenCalledWith()
  })

  it('rejects a connection when the token is missing', () => {
    const next = vi.fn()

    createSocketAuthMiddleware({ handshake: { auth: {} }, data: {} } as any, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error)
  })
})

describe('socket event registration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('joins the authenticated pair room instead of trusting the client payload', () => {
    const handlers: Record<string, (payload: any) => void> = {}
    const socket = {
      data: {
        user: {
          id: 3,
          username: 'alice',
          partnerId: 9,
        },
      },
      join: vi.fn(),
      leave: vi.fn(),
      to: vi.fn(() => ({ emit: vi.fn() })),
      on: vi.fn((event: string, handler: (payload: any) => void) => {
        handlers[event] = handler
      }),
    }

    createSocketEventRegistrar(socket as any)
    handlers.join_room?.({ userId: 100, partnerId: 200 })

    expect(socket.join).toHaveBeenCalledWith('3_9')
  })

  it('broadcasts updates only to the authenticated pair room', () => {
    const handlers: Record<string, (payload: any) => void> = {}
    const emit = vi.fn()
    const socket = {
      data: {
        user: {
          id: 11,
          username: 'bob',
          partnerId: 4,
        },
      },
      join: vi.fn(),
      leave: vi.fn(),
      to: vi.fn(() => ({ emit })),
      on: vi.fn((event: string, handler: (payload: any) => void) => {
        handlers[event] = handler
      }),
    }

    createSocketEventRegistrar(socket as any)
    handlers.todo_update?.({
      userId: 99,
      partnerId: 100,
      action: 'created',
      payload: { id: 123 },
    })

    expect(socket.to).toHaveBeenCalledWith('4_11')
    expect(emit).toHaveBeenCalledWith('todo_update', {
      action: 'created',
      payload: { id: 123 },
    })
  })
})
