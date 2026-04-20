import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authAPI, User } from '../services/api'
import { Toast } from 'antd-mobile'

interface AuthState {
  token: string | null
  user: User | null
  loading: boolean
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

      login: async (username: string, password: string) => {
        set({ loading: true })
        try {
          const response = await authAPI.login({ username, password })
          const { token, user } = response.data
          set({ token, user })
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
          set({ token, user })
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
          await get().loadProfile() // 刷新用户信息
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
          await get().loadProfile() // 刷新用户信息
          Toast.show(response.data.message || '解绑成功')
        } catch (error: any) {
          Toast.show(error.response?.data?.error || '解绑失败')
          throw error
        } finally {
          set({ loading: false })
        }
      },

      logout: () => {
        set({ token: null, user: null })
        localStorage.removeItem('token')
        Toast.show('已退出登录')
      },

      loadProfile: async () => {
        try {
          const response = await authAPI.getProfile()
          set({ user: response.data })
        } catch (error) {
          console.error('Failed to load profile:', error)
          throw error
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }), // 只持久化token和用户信息
    }
  )
)
