import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

// 请求拦截器：添加token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：处理401错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// 用户类型定义
export interface User {
  id: number
  username: string
  email?: string
  inviteCode: string
  partnerId?: number
  partner?: {
    id: number
    username: string
    email?: string
  }
  createdAt: string
  lastLogin: string
}

// 认证相关API
export const authAPI = {
  register: (data: { username: string; password: string; email?: string }) =>
    api.post<{ token: string; user: User }>('/auth/register', data),

  login: (data: { username: string; password: string }) =>
    api.post<{ token: string; user: User }>('/auth/login', data),

  bindPartner: (data: { inviteCode: string }) =>
    api.post<{ success: boolean; message: string; partner: { id: number; username: string } }>('/auth/bind-partner', data),

  unbindPartner: () =>
    api.post<{ success: boolean; message: string }>('/auth/unbind-partner'),

  getProfile: () =>
    api.get<User>('/auth/profile'),
}

// 时间线节点类型定义
export interface TimelineNode {
  id: number
  name: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  order: number
  deadline?: string
  progress: number
  createdAt: string
  updatedAt: string
}

export interface CreateNodeData {
  name: string
  description?: string
  deadline?: string
}

export interface UpdateNodeData {
  name?: string
  description?: string
  deadline?: string
  status?: string
}

// 时间线相关API
export const timelineAPI = {
  getTimeline: () =>
    api.get<{ nodes: TimelineNode[]; overallProgress: number }>('/timeline'),

  createNode: (data: CreateNodeData) =>
    api.post<TimelineNode>('/timeline', data),

  updateNode: (id: number, data: UpdateNodeData) =>
    api.put<TimelineNode>(`/timeline/${id}`, data),

  deleteNode: (id: number) =>
    api.delete(`/timeline/${id}`),

  updateOrder: (nodes: { id: number; order: number }[]) =>
    api.post('/timeline/update-order', { nodes }),
}

export default api
