import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from '../store/authStore'

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

// Mock authAPI
vi.mock('../services/api', () => ({
  authAPI: {
    login: vi.fn(),
    register: vi.fn(),
    bindPartner: vi.fn(),
    unbindPartner: vi.fn(),
    getProfile: vi.fn(),
  },
}))

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      token: null,
      user: null,
      loading: false,
      partnerId: null,
      partner: null,
      socket: null,
    })
  })

  describe('initial state', () => {
    it('should have null token initially', () => {
      const state = useAuthStore.getState()
      expect(state.token).toBeNull()
    })

    it('should have null user initially', () => {
      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
    })

    it('should have null socket initially', () => {
      const state = useAuthStore.getState()
      expect(state.socket).toBeNull()
    })

    it('should not be loading initially', () => {
      const state = useAuthStore.getState()
      expect(state.loading).toBe(false)
    })
  })

  describe('login action', () => {
    it('should set token and user on successful login', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        inviteCode: '123456',
        partnerId: null,
      }
      const mockToken = 'jwt-token-here'

      const { authAPI } = await import('../services/api')
      ;(authAPI.login as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { token: mockToken, user: mockUser },
      })

      await useAuthStore.getState().login('testuser', 'password123')

      const state = useAuthStore.getState()
      expect(state.token).toBe(mockToken)
      expect(state.user).toEqual(mockUser)
    })

    it('should set loading true during login', async () => {
      const { authAPI } = await import('../services/api')
      ;(authAPI.login as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        expect(useAuthStore.getState().loading).toBe(true)
        await new Promise(r => setTimeout(r, 10))
        return { data: { token: 'token', user: {} } }
      })

      const loginPromise = useAuthStore.getState().login('test', 'password')
      expect(useAuthStore.getState().loading).toBe(true)
      await loginPromise
      expect(useAuthStore.getState().loading).toBe(false)
    })
  })

  describe('logout action', () => {
    it('should clear token and user on logout', () => {
      // First set some state
      useAuthStore.setState({
        token: 'some-token',
        user: { id: 1, username: 'test' } as any,
      })

      useAuthStore.getState().logout()

      const state = useAuthStore.getState()
      expect(state.token).toBeNull()
      expect(state.user).toBeNull()
    })

    it('should disconnect socket on logout', () => {
      const mockSocket = {
        emit: vi.fn(),
        disconnect: vi.fn(),
      }
      useAuthStore.setState({
        socket: mockSocket as any,
        user: { id: 1 } as any,
      })

      useAuthStore.getState().logout()

      expect(mockSocket.disconnect).toHaveBeenCalled()
    })
  })

  describe('connectSocket action', () => {
    it('should not connect if no partnerId', () => {
      useAuthStore.setState({
        user: { id: 1, partnerId: null } as any,
        socket: null,
      })

      expect(() => useAuthStore.getState().connectSocket()).not.toThrow()
      expect(useAuthStore.getState().socket).toBeNull()
    })

    it('should not reconnect if socket already connected', () => {
      const mockSocket = { connected: true }
      useAuthStore.setState({
        user: { id: 1, partnerId: 2 } as any,
        socket: mockSocket as any,
      })

      expect(() => useAuthStore.getState().connectSocket()).not.toThrow()
    })
  })
})
