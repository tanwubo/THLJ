export type AiPage = 'timeline' | 'node-detail' | 'statistics' | 'settings' | 'unknown'
export type AiStatus = 'ready' | 'needs_input' | 'unsupported'
export type AiActionType = 'create_node' | 'create_todo' | 'create_expense'
export type ExpenseType = 'income' | 'expense'

export interface AiContextTodo {
  id: number
  content: string
}

export interface AiContextNode {
  id: number
  name: string
  todos: AiContextTodo[]
}

export interface AiCommandContext {
  today: string
  page: AiPage
  currentNodeId: number | null
  nodes: AiContextNode[]
}

export interface AiCandidateNode {
  id: number
  name: string
}

export interface AiCandidateTodo {
  id: number
  content: string
  nodeId: number
  nodeName: string
}

export interface AiDraftFields {
  name?: unknown
  description?: unknown
  deadline?: unknown
  budget?: unknown
  nodeId?: unknown
  nodeName?: unknown
  content?: unknown
  todoId?: unknown
  todoName?: unknown
  type?: unknown
  amount?: unknown
  category?: unknown
  [key: string]: unknown
}

export interface AiDraft {
  actionType: AiActionType
  fields: AiDraftFields
}

export interface AiParseRequest {
  message: string
  context: AiCommandContext
}

export interface AiParseResult {
  status: AiStatus
  draft: AiDraft | null
  summary: string
  missingFields: string[]
  candidates: {
    nodes?: AiCandidateNode[]
    todos?: AiCandidateTodo[]
  }
}

export interface AiProvider {
  parse(request: AiParseRequest): Promise<AiParseResult> | AiParseResult
}

export interface AiProviderError {
  code: string
  message: string
  details?: unknown
}
