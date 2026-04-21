import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh'

const mockStore = vi.fn()

vi.mock('../store/authStore', () => ({
  useAuthStore: () => mockStore(),
}))

function TestHarness(props: { refresh: () => void }) {
  useRealtimeRefresh(['todo_update', 'memo_update'], props.refresh)
  return null
}

describe('useRealtimeRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('subscribes to each event and refetches when a realtime update arrives', () => {
    const handlers: Record<string, () => void> = {}
    const socket = {
      on: vi.fn((event: string, handler: () => void) => {
        handlers[event] = handler
      }),
      off: vi.fn(),
    }
    const refresh = vi.fn()

    mockStore.mockReturnValue({ socket })

    render(<TestHarness refresh={refresh} />)
    handlers.todo_update?.()

    expect(socket.on).toHaveBeenCalledWith('todo_update', expect.any(Function))
    expect(socket.on).toHaveBeenCalledWith('memo_update', expect.any(Function))
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
