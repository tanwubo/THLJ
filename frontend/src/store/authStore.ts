import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { io, Socket } from 'socket.io-client'
import { authAPI, User } from '../services/api'
import { Toast } from 'antd-mobile'
import { getSocketServerUrl } from '../config/runtime'

interface AuthState {
  token: string | null
  user: User | null
  loading: boolean
  partnerId: number | null
  partner: { id: number; username: string } | null
  socket: Socket | null
  _hasHydrated: boolean
  setHasHydrated: (state: boolean) => void
  connectSocket: () => void
  disconnectSocket: () => void
  emitRealtimeEvent: (event: string, action: string, payload?: any) => void
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string, email?: string) => Promise<void>
  bindPartner: (inviteCode: string) => Promise<void>
  unbindPartner: () => Promise<void>
  logout: () => void
  loadProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      loading: false,
      partnerId: null,
      partner: null,
      socket: null,
      _hasHydrated: false,
      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),

      connectSocket: () => {
        const state = useAuthStore.getState()
        if (!state.user?.partnerId || state.socket || !state.token) return

        const socketUrl = getSocketServerUrl()

        const newSocket = io(socketUrl, {
          auth: { token: state.token },
          path: '/socket.io',
          transports: ['websocket', 'polling'],
        })

        useAuthStore.setState({ socket: newSocket })
      },

      disconnectSocket: () => {
        const state = useAuthStore.getState()
        if (state.socket) {
          state.socket.emit('leave_room')
          state.socket.disconnect()
          useAuthStore.setState({ socket: null })
        }
      },

      emitRealtimeEvent: (event: string, action: string, payload?: any) => {
        const state = useAuthStore.getState()
        if (!state.socket || !state.user?.partnerId) {
          return
        }
        state.socket.emit(event, { action, payload })
      },

      login: async (username: string, password: string) => {
        set({ loading: true })
        try {
          const response = await authAPI.login({ username, password })
          const { token, user } = response.data
          set({
            token,
            user,
            partnerId: user.partnerId || null,
            partner: (user as any).partner || null
          })
          localStorage.setItem('token', token)
          Toast.show('登录成功')
        } catch (error: any) {
          Toast.show(error.response?.data?.error || '登录失败')
          throw error
        } finally {
          set({ loading: false })
        }
      },

      register: async (username: string, password: string, email?: string) => {
        set({ loading: true })
        try {
          const response = await authAPI.register({ username, password, email })
          const { token, user } = response.data
          set({
            token,
            user,
            partnerId: user.partnerId || null,
            partner: (user as any).partner || null
          })
          localStorage.setItem('token', token)
          Toast.show('注册成功')
        } catch (error: any) {
          Toast.show(error.response?.data?.error || '注册失败')
          throw error
        } finally {
          set({ loading: false })
        }
      },

      bindPartner: async (inviteCode: string) => {
        set({ loading: true })
        try {
          const response = await authAPI.bindPartner({ inviteCode })
          await get().loadProfile()
          Toast.show(response.data.message || '绑定成功')
        } catch (error: any) {
          Toast.show(error.response?.data?.error || '绑定失败')
          throw error
        } finally {
          set({ loading: false })
        }
      },

      unbindPartner: async () => {
        set({ loading: true })
        try {
          const response = await authAPI.unbindPartner()
          await get().loadProfile()
          Toast.show(response.data.message || '解绑成功')
        } catch (error: any) {
          Toast.show(error.response?.data?.error || '解绑失败')
          throw error
        } finally {
          set({ loading: false })
        }
      },

      logout: () => {
        const state = useAuthStore.getState()
        if (state.socket) {
          state.socket.emit('leave_room')
          state.socket.disconnect()
        }
        set({ token: null, user: null, partnerId: null, partner: null, socket: null })
        localStorage.removeItem('token')
        Toast.show('已退出登录')
      },

      loadProfile: async () => {
        try {
          const response = await authAPI.getProfile()
          const user = response.data
          set({
            user,
            partnerId: user.partnerId || null,
            partner: (user as any).partner || null
          })
        } catch (error) {
          console.error('Failed to load profile:', error)
          throw error
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
