import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { useAuthSocketLifecycle } from '../hooks/useAuthSocketLifecycle'

const mockStore = vi.fn()

vi.mock('../store/authStore', () => ({
  useAuthStore: () => mockStore(),
}))

function TestHarness() {
  useAuthSocketLifecycle()
  return null
}

describe('useAuthSocketLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('connects when hydration is complete and the user has a bound partner', () => {
    const connectSocket = vi.fn()
    const disconnectSocket = vi.fn()

    mockStore.mockReturnValue({
      token: 'jwt-token',
      user: { id: 1, partnerId: 2 },
      socket: null,
      _hasHydrated: true,
      connectSocket,
      disconnectSocket,
    })

    render(<TestHarness />)

    expect(connectSocket).toHaveBeenCalledTimes(1)
    expect(disconnectSocket).not.toHaveBeenCalled()
  })

  it('disconnects when the current state can no longer keep a realtime session alive', () => {
    const connectSocket = vi.fn()
    const disconnectSocket = vi.fn()

    mockStore.mockReturnValue({
      token: null,
      user: { id: 1, partnerId: 2 },
      socket: { connected: true },
      _hasHydrated: true,
      connectSocket,
      disconnectSocket,
    })

    render(<TestHarness />)

    expect(disconnectSocket).toHaveBeenCalledTimes(1)
    expect(connectSocket).not.toHaveBeenCalled()
  })
})
