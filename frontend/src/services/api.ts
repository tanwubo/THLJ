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

// 待办事项 API
export interface Todo {
  id: number
  nodeId: number
  content: string
  status: 'pending' | 'completed' | 'cancelled'
  assigneeId?: number
  assigneeName?: string
  deadline?: string
  createdAt: string
}

export const todoAPI = {
  getTodos: (nodeId: number) =>
    api.get<Todo[]>(`/todos?nodeId=${nodeId}`),
  createTodo: (data: { nodeId: number; content: string; assigneeId?: number; deadline?: string }) =>
    api.post<Todo>('/todos', data),
  updateTodo: (id: number, data: Partial<Todo>) =>
    api.put<Todo>(`/todos/${id}`, data),
  deleteTodo: (id: number) =>
    api.delete(`/todos/${id}`),
  updateTodoStatus: (id: number, status: string) =>
    api.put<Todo>(`/todos/${id}/status`, { status }),
};

// 费用记录 API
export interface Expense {
  id: number
  nodeId: number
  type: 'income' | 'expense'
  amount: number
  category: string
  description?: string
  creatorName?: string
  createdAt: string
}

export interface ExpenseStats {
  totalIncome: number
  totalExpense: number
  balance: number
}

export const expenseAPI = {
  getExpenses: (nodeId: number) =>
    api.get<{ expenses: Expense[]; stats: ExpenseStats; categories: { income: string[]; expense: string[] } }>(`/expenses?nodeId=${nodeId}`),
  createExpense: (data: { nodeId: number; type: string; amount: number; category: string; description?: string }) =>
    api.post<Expense>('/expenses', data),
  updateExpense: (id: number, data: Partial<Expense>) =>
    api.put<Expense>(`/expenses/${id}`, data),
  deleteExpense: (id: number) =>
    api.delete(`/expenses/${id}`),
};

// 备忘录 API
export interface Memo {
  id: number
  nodeId: number
  content: string
  updatedAt: string
}

export const memoAPI = {
  getMemo: (nodeId: number) =>
    api.get<Memo | null>(`/memos?nodeId=${nodeId}`),
  saveMemo: (data: { nodeId: number; content: string }) =>
    api.post<Memo>('/memos', data),
};

// 附件 API
export interface Attachment {
  id: number
  nodeId: number
  fileName: string
  filePath: string
  fileSize: number
  fileType: string
  uploaderName?: string
  createdAt: string
}

export const attachmentAPI = {
  getAttachments: (nodeId: number) =>
    api.get<Attachment[]>(`/attachments?nodeId=${nodeId}`),
  uploadAttachment: (nodeId: number, file: File) => {
    const formData = new FormData();
    formData.append('nodeId', String(nodeId));
    formData.append('file', file);
    return api.post<Attachment>('/attachments', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteAttachment: (id: number) =>
    api.delete(`/attachments/${id}`),
};

export default api
