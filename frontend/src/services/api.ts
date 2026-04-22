import axios from 'axios'
import { getApiBaseUrl } from '../config/runtime'

const api = axios.create({
  baseURL: getApiBaseUrl(),
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
      // 通知 authStore 清理状态
      window.dispatchEvent(new Event('auth:logout'))
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
  isAdmin?: boolean
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

  getBackup: () =>
    api.get('/auth/backup'),
}

// 时间线节点类型定义
export interface TimelineNode {
  id: number
  name: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  order: number
  budget?: number | null
  deadline?: string
  progress: number
  createdAt: string
  updatedAt: string
}

export interface TimelineTemplateNode {
  id: number
  templateId: number
  name: string
  description?: string
  order: number
}

export interface TimelineTemplate {
  id: number
  name: string
  description?: string
  isActive?: boolean
  nodeCount?: number
  nodes?: TimelineTemplateNode[]
}

export interface TimelineTemplatePayload {
  name: string
  description?: string
  isActive: boolean
  nodes: Array<{
    name: string
    description?: string
  }>
}

export interface WorkbenchExpense extends Expense {
  todoId: number
}

export interface WorkbenchAttachment extends Attachment {
  todoId: number
}

export interface WorkbenchTodo extends Todo {
  expenses: WorkbenchExpense[]
  attachments: WorkbenchAttachment[]
}

export interface NodeWorkbench {
  node: TimelineNode & {
    expenses?: Expense[]
    attachments?: Attachment[]
  }
  todos: WorkbenchTodo[]
  memo: Memo | null
}

type RawTimelineNode = {
  id: number
  name: string
  description?: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  order: number
  budget?: number | null
  deadline?: string | null
  progress?: number
  created_at?: string
  updated_at?: string
}

type RawExpense = {
  id: number
  node_id: number
  todo_id?: number | null
  type: 'income' | 'expense'
  amount: number
  category: string
  description?: string | null
  creator_name?: string | null
  created_at?: string
}

type RawAttachment = {
  id: number
  node_id: number
  todo_id?: number | null
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  uploader_name?: string | null
  created_at?: string
}

type RawWorkbenchTodo = {
  id: number
  node_id: number
  content: string
  status: 'pending' | 'completed' | 'cancelled'
  assignee_id?: number | null
  assignee_name?: string | null
  deadline?: string | null
  created_at?: string
  expenses?: RawExpense[]
  attachments?: RawAttachment[]
}

type RawMemo = {
  id: number
  node_id: number
  content: string
  updated_at?: string
}

type RawNodeWorkbench = {
  node: RawTimelineNode & {
    expenses?: RawExpense[]
    attachments?: RawAttachment[]
  }
  todos: RawWorkbenchTodo[]
  memo: RawMemo | null
}

function normalizeTimelineNode(node: RawTimelineNode): TimelineNode {
  return {
    id: node.id,
    name: node.name,
    description: node.description ?? undefined,
    status: node.status,
    order: node.order,
    budget: node.budget ?? null,
    deadline: node.deadline ?? undefined,
    progress: node.progress ?? 0,
    createdAt: node.created_at ?? '',
    updatedAt: node.updated_at ?? '',
  }
}

function normalizeExpense(expense: RawExpense): Expense {
  return {
    id: expense.id,
    nodeId: expense.node_id,
    todoId: expense.todo_id ?? undefined,
    type: expense.type,
    amount: Number(expense.amount),
    category: expense.category,
    description: expense.description ?? undefined,
    creatorName: expense.creator_name ?? undefined,
    createdAt: expense.created_at ?? '',
  }
}

function normalizeAttachment(attachment: RawAttachment): Attachment {
  return {
    id: attachment.id,
    nodeId: attachment.node_id,
    todoId: attachment.todo_id ?? undefined,
    fileName: attachment.file_name,
    filePath: attachment.file_path,
    fileSize: attachment.file_size,
    fileType: attachment.file_type,
    uploaderName: attachment.uploader_name ?? undefined,
    createdAt: attachment.created_at ?? '',
  }
}

function normalizeWorkbenchTodo(todo: RawWorkbenchTodo): WorkbenchTodo {
  return {
    id: todo.id,
    nodeId: todo.node_id,
    content: todo.content,
    status: todo.status,
    assigneeId: todo.assignee_id ?? undefined,
    assigneeName: todo.assignee_name ?? undefined,
    deadline: todo.deadline ?? undefined,
    createdAt: todo.created_at ?? '',
    expenses: (todo.expenses ?? []).map((expense) => ({
      ...normalizeExpense(expense),
      todoId: expense.todo_id ?? 0,
    })),
    attachments: (todo.attachments ?? []).map((attachment) => ({
      ...normalizeAttachment(attachment),
      todoId: attachment.todo_id ?? 0,
    })),
  }
}

function normalizeNodeWorkbench(workbench: RawNodeWorkbench): NodeWorkbench {
  return {
    node: {
      ...normalizeTimelineNode(workbench.node),
      expenses: (workbench.node.expenses ?? []).map(normalizeExpense),
      attachments: (workbench.node.attachments ?? []).map(normalizeAttachment),
    },
    todos: workbench.todos.map(normalizeWorkbenchTodo),
    memo: workbench.memo
      ? {
          id: workbench.memo.id,
          nodeId: workbench.memo.node_id,
          content: workbench.memo.content,
          updatedAt: workbench.memo.updated_at ?? '',
        }
      : null,
  }
}

export interface CreateNodeData {
  name: string
  description?: string
  deadline?: string
  budget?: number
}

export interface UpdateNodeData {
  name?: string
  description?: string
  deadline?: string
  status?: string
  budget?: number
}

// 时间线相关API
export const timelineAPI = {
  getTimeline: () =>
    api.get<{ nodes: RawTimelineNode[]; overallProgress: number }>('/timeline').then((response) => ({
      ...response,
      data: {
        overallProgress: response.data.overallProgress,
        nodes: (response.data.nodes ?? []).map(normalizeTimelineNode),
      },
    })),

  getWorkbench: (id: number) =>
    api.get<RawNodeWorkbench>(`/timeline/${id}/workbench`).then((response) => ({
      ...response,
      data: normalizeNodeWorkbench(response.data),
    })),

  createNode: (data: CreateNodeData) =>
    api.post<RawTimelineNode>('/timeline', data).then((response) => ({
      ...response,
      data: normalizeTimelineNode(response.data),
    })),

  updateNode: (id: number, data: UpdateNodeData) =>
    api.put<RawTimelineNode>(`/timeline/${id}`, data).then((response) => ({
      ...response,
      data: normalizeTimelineNode(response.data),
    })),

  deleteNode: (id: number) =>
    api.delete(`/timeline/${id}`),

  updateOrder: (nodes: { id: number; order: number }[]) =>
    api.post('/timeline/update-order', { nodes }),
}

export const timelineTemplateAPI = {
  listTemplates: (includeInactive = false) =>
    api.get<{ templates: TimelineTemplate[] }>(`/timeline-templates${includeInactive ? '?includeInactive=1' : ''}`),

  getTemplate: (id: number) =>
    api.get<TimelineTemplate>(`/timeline-templates/${id}`),

  createTemplate: (data: TimelineTemplatePayload) =>
    api.post<TimelineTemplate>('/timeline-templates', data),

  updateTemplate: (id: number, data: TimelineTemplatePayload) =>
    api.put<TimelineTemplate>(`/timeline-templates/${id}`, data),

  deleteTemplate: (id: number) =>
    api.delete(`/timeline-templates/${id}`),

  applyTemplate: (templateId: number) =>
    api.post('/timeline-templates/apply', { templateId }),
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
  todoId?: number
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
  createExpense: (data: { todoId: number; type: string; amount: number; category?: string; description?: string }) =>
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
  todoId?: number
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
  uploadAttachment: (todoId: number, file: File) => {
    const formData = new FormData();
    formData.append('todoId', String(todoId));
    formData.append('file', file);
    return api.post<Attachment>('/attachments', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteAttachment: (id: number) =>
    api.delete(`/attachments/${id}`),
};

export default api
