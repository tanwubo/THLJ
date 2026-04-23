import type {
  AiCandidateNode,
  AiCandidateTodo,
  AiCommandContext,
  AiDraft,
  AiDraftFields,
  AiParseResult,
  AiStatus,
  AiActionType,
} from './types'

const UNSUPPORTED_RESULT = {
  status: 'unsupported' as AiStatus,
  draft: null,
  summary: '暂不支持这个操作。当前只支持新增节点、待办和费用。',
  missingFields: [],
  candidates: {},
}

const VALID_EXPENSE_CATEGORIES = {
  income: ['彩礼', '礼金', '嫁妆回礼', '其他收入'],
  expense: ['婚宴', '婚庆', '婚车', '婚纱摄影', '三金/五金', '酒店预订', '婚车车队', '蜜月旅行', '其他支出'],
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValidStatus(value: unknown): value is AiStatus {
  return value === 'ready' || value === 'needs_input' || value === 'unsupported'
}

function isValidActionType(value: unknown): value is AiActionType {
  return value === 'create_node' || value === 'create_todo' || value === 'create_expense'
}

function normalizeDate(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function normalizeBudget(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined
  }

  return value
}

function normalizeAmount(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined
  }

  return value
}

function getNodeCandidates(context: AiCommandContext): AiCandidateNode[] {
  return context.nodes.map(node => ({ id: node.id, name: node.name }))
}

function getTodosForNode(context: AiCommandContext, nodeId: number): AiCandidateTodo[] {
  const node = context.nodes.find(item => item.id === nodeId)
  if (!node) {
    return []
  }

  return node.todos.map(todo => ({
    id: todo.id,
    content: todo.content,
    nodeId: node.id,
    nodeName: node.name,
  }))
}

function hasNode(context: AiCommandContext, nodeId: unknown): nodeId is number {
  return typeof nodeId === 'number' && Number.isInteger(nodeId) && context.nodes.some(node => node.id === nodeId)
}

function hasTodo(context: AiCommandContext, todoId: unknown): todoId is number {
  return typeof todoId === 'number' && Number.isInteger(todoId) && context.nodes.some(node => node.todos.some(todo => todo.id === todoId))
}

function findTodoNode(context: AiCommandContext, todoId: number): { nodeId: number; nodeName: string } | null {
  for (const node of context.nodes) {
    if (node.todos.some(todo => todo.id === todoId)) {
      return { nodeId: node.id, nodeName: node.name }
    }
  }

  return null
}

function normalizeExpenseCategory(fields: AiDraftFields, type: 'income' | 'expense'): string {
  const category = normalizeString(fields.category)
  if (!category) {
    return type === 'income' ? '其他收入' : '其他支出'
  }

  const validCategories = VALID_EXPENSE_CATEGORIES[type]
  return validCategories.includes(category as (typeof validCategories)[number])
    ? category
    : type === 'income'
      ? '其他收入'
      : '其他支出'
}

function normalizeNodeDraft(draft: AiDraft): AiParseResult {
  const name = normalizeString(draft.fields.name)
  if (!name) {
    return UNSUPPORTED_RESULT
  }

  const fields: AiDraftFields = { name }
  const deadline = normalizeDate(draft.fields.deadline)
  if (deadline) {
    fields.deadline = deadline
  }

  const description = normalizeString(draft.fields.description)
  if (description) {
    fields.description = description
  }

  const budget = normalizeBudget(draft.fields.budget)
  if (budget !== undefined) {
    fields.budget = budget
  }

  return {
    status: 'ready',
    draft: { actionType: 'create_node', fields },
    summary: '',
    missingFields: [],
    candidates: {},
  }
}

function normalizeTodoDraft(draft: AiDraft, context: AiCommandContext): AiParseResult {
  const content = normalizeString(draft.fields.content)
  if (!content) {
    return UNSUPPORTED_RESULT
  }

  const fields: AiDraftFields = { content }
  const nodeId = draft.fields.nodeId
  if (hasNode(context, nodeId)) {
    fields.nodeId = nodeId
    return {
      status: 'ready',
      draft: { actionType: 'create_todo', fields },
      summary: '',
      missingFields: [],
      candidates: {},
    }
  }

  return {
    status: 'needs_input',
    draft: { actionType: 'create_todo', fields },
    summary: '',
    missingFields: ['nodeId'],
    candidates: { nodes: getNodeCandidates(context) },
  }
}

function normalizeExpenseDraft(draft: AiDraft, context: AiCommandContext): AiParseResult {
  const fields: AiDraftFields = {}
  const type = draft.fields.type === 'income' ? 'income' : 'expense'
  fields.type = type

  const amount = normalizeAmount(draft.fields.amount)
  if (amount === undefined) {
    return UNSUPPORTED_RESULT
  }
  fields.amount = amount

  const category = normalizeExpenseCategory(draft.fields, type)
  fields.category = category

  const description = normalizeString(draft.fields.description)
  if (description) {
    fields.description = description
  }

  const todoId = draft.fields.todoId
  if (hasTodo(context, todoId)) {
    const todoNode = findTodoNode(context, todoId as number)
    if (todoNode) {
      fields.todoId = todoId
      if (typeof draft.fields.todoName === 'string' && draft.fields.todoName.trim()) {
        fields.todoName = draft.fields.todoName.trim()
      }
      fields.nodeId = todoNode.nodeId
      fields.nodeName = todoNode.nodeName
    }

    return {
      status: 'ready',
      draft: { actionType: 'create_expense', fields },
      summary: '',
      missingFields: [],
      candidates: {},
    }
  }

  const nodeId = draft.fields.nodeId
  if (hasNode(context, nodeId)) {
    return {
      status: 'needs_input',
      draft: { actionType: 'create_expense', fields: { ...fields, nodeId, nodeName: context.nodes.find(node => node.id === nodeId)?.name } },
      summary: '',
      missingFields: ['todoId'],
      candidates: { todos: getTodosForNode(context, nodeId) },
    }
  }

  return {
    status: 'needs_input',
    draft: { actionType: 'create_expense', fields },
    summary: '',
    missingFields: ['todoId'],
    candidates: { nodes: getNodeCandidates(context) },
  }
}

export function validateAiParseResult(raw: AiParseResult, context: AiCommandContext): AiParseResult {
  if (!isRecord(raw) || !isValidStatus(raw.status) || !isRecord(raw.draft) || !isValidActionType(raw.draft.actionType)) {
    return UNSUPPORTED_RESULT
  }

  if (raw.status !== 'ready') {
    return raw
  }

  if (raw.draft.actionType === 'create_node') {
    const normalized = normalizeNodeDraft(raw.draft)
    return { ...normalized, summary: raw.summary, missingFields: raw.missingFields, candidates: raw.candidates }
  }

  if (raw.draft.actionType === 'create_todo') {
    const normalized = normalizeTodoDraft(raw.draft, context)
    return { ...normalized, summary: raw.summary }
  }

  if (raw.draft.actionType === 'create_expense') {
    const normalized = normalizeExpenseDraft(raw.draft, context)
    return { ...normalized, summary: raw.summary }
  }

  return UNSUPPORTED_RESULT
}
