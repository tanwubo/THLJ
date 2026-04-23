import type {
  AiCandidateNode,
  AiCandidateTodo,
  AiCommandContext,
  AiDraft,
  AiDraftFields,
  AiParseResult,
  AiStatus,
  AiActionType,
  ExpenseType,
} from './types'

const UNSUPPORTED_MESSAGE = '暂不支持这个操作。当前只支持新增节点、待办和费用。'

const VALID_EXPENSE_CATEGORIES: Record<ExpenseType, readonly string[]> = {
  income: ['彩礼', '礼金', '嫁妆回礼', '其他收入'],
  expense: ['婚宴', '婚庆', '婚车', '婚纱摄影', '三金/五金', '酒店预订', '婚车车队', '蜜月旅行', '其他支出'],
}

function unsupportedResult(): AiParseResult {
  return {
    status: 'unsupported',
    draft: null,
    summary: UNSUPPORTED_MESSAGE,
    missingFields: [],
    candidates: {},
  }
}

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

function getNodeById(context: AiCommandContext, nodeId: number) {
  return context.nodes.find(node => node.id === nodeId) ?? null
}

function getTodoById(context: AiCommandContext, todoId: number): { nodeId: number; nodeName: string; todoName: string } | null {
  for (const node of context.nodes) {
    const todo = node.todos.find(item => item.id === todoId)
    if (todo) {
      return {
        nodeId: node.id,
        nodeName: node.name,
        todoName: todo.content,
      }
    }
  }

  return null
}

function hasTodo(context: AiCommandContext, todoId: unknown): todoId is number {
  return typeof todoId === 'number' && Number.isInteger(todoId) && getTodoById(context, todoId) !== null
}

function isValidExpenseCategory(category: string, type: ExpenseType): boolean {
  return (VALID_EXPENSE_CATEGORIES[type] as readonly string[]).includes(category)
}

function normalizeExpenseCategory(fields: AiDraftFields, type: ExpenseType): string {
  const category = normalizeString(fields.category)
  if (!category) {
    return type === 'income' ? '其他收入' : '其他支出'
  }

  return isValidExpenseCategory(category, type) ? category : type === 'income' ? '其他收入' : '其他支出'
}

function sanitizeNodeDraft(raw: AiParseResult): AiParseResult {
  if (!raw.draft || raw.draft.actionType !== 'create_node') {
    return unsupportedResult()
  }

  const name = normalizeString(raw.draft.fields.name)
  if (!name) {
    return unsupportedResult()
  }

  const budgetValue = raw.draft.fields.budget
  const budget = budgetValue === undefined ? undefined : normalizeBudget(budgetValue)
  if (budgetValue !== undefined && budget === undefined) {
    return unsupportedResult()
  }

  const fields: AiDraftFields = { name }
  const deadline = normalizeDate(raw.draft.fields.deadline)
  if (deadline) {
    fields.deadline = deadline
  }

  const description = normalizeString(raw.draft.fields.description)
  if (description) {
    fields.description = description
  }

  if (budget !== undefined) {
    fields.budget = budget
  }

  return {
    status: 'ready',
    draft: { actionType: 'create_node', fields },
    summary: raw.summary,
    missingFields: [],
    candidates: {},
  }
}

function sanitizeTodoDraft(raw: AiParseResult, context: AiCommandContext): AiParseResult {
  if (!raw.draft || raw.draft.actionType !== 'create_todo') {
    return unsupportedResult()
  }

  const content = normalizeString(raw.draft.fields.content)
  if (!content) {
    return unsupportedResult()
  }

  const fields: AiDraftFields = { content }
  const nodeId = raw.draft.fields.nodeId
  if (hasNode(context, nodeId)) {
    fields.nodeId = nodeId
    return {
      status: 'ready',
      draft: { actionType: 'create_todo', fields },
      summary: raw.summary,
      missingFields: [],
      candidates: {},
    }
  }

  return {
    status: 'needs_input',
    draft: { actionType: 'create_todo', fields },
    summary: raw.summary,
    missingFields: ['nodeId'],
    candidates: { nodes: getNodeCandidates(context) },
  }
}

function sanitizeExpenseDraft(raw: AiParseResult, context: AiCommandContext): AiParseResult {
  if (!raw.draft || raw.draft.actionType !== 'create_expense') {
    return unsupportedResult()
  }

  const amount = normalizeAmount(raw.draft.fields.amount)
  if (amount === undefined) {
    return unsupportedResult()
  }

  const type: ExpenseType = raw.draft.fields.type === 'income' ? 'income' : 'expense'
  const fields: AiDraftFields = {
    type,
    amount,
    category: normalizeExpenseCategory(raw.draft.fields, type),
  }

  const description = normalizeString(raw.draft.fields.description)
  if (description) {
    fields.description = description
  }

  const todoId = raw.draft.fields.todoId
  if (hasTodo(context, todoId)) {
    const groundedTodo = getTodoById(context, todoId)
    if (!groundedTodo) {
      return unsupportedResult()
    }

    fields.todoId = todoId
    fields.todoName = groundedTodo.todoName
    fields.nodeId = groundedTodo.nodeId
    fields.nodeName = groundedTodo.nodeName

    return {
      status: 'ready',
      draft: { actionType: 'create_expense', fields },
      summary: raw.summary,
      missingFields: [],
      candidates: {},
    }
  }

  const nodeId = raw.draft.fields.nodeId
  if (hasNode(context, nodeId)) {
    const groundedNode = getNodeById(context, nodeId)
    if (!groundedNode) {
      return unsupportedResult()
    }

    fields.nodeId = groundedNode.id
    fields.nodeName = groundedNode.name

    return {
      status: 'needs_input',
      draft: { actionType: 'create_expense', fields },
      summary: raw.summary,
      missingFields: ['todoId'],
      candidates: { todos: getTodosForNode(context, groundedNode.id) },
    }
  }

  return {
    status: 'needs_input',
    draft: { actionType: 'create_expense', fields },
    summary: raw.summary,
    missingFields: ['todoId'],
    candidates: { nodes: getNodeCandidates(context) },
  }
}

function sanitizeActionableDraft(raw: AiParseResult, context: AiCommandContext): AiParseResult {
  if (!raw.draft || !isValidActionType(raw.draft.actionType)) {
    return unsupportedResult()
  }

  if (!isRecord(raw.draft.fields)) {
    return unsupportedResult()
  }

  if (raw.draft.actionType === 'create_node') {
    return sanitizeNodeDraft(raw)
  }

  if (raw.draft.actionType === 'create_todo') {
    return sanitizeTodoDraft(raw, context)
  }

  return sanitizeExpenseDraft(raw, context)
}

export function validateAiParseResult(raw: AiParseResult, context: AiCommandContext): AiParseResult {
  if (!isRecord(raw) || !isValidStatus(raw.status)) {
    return unsupportedResult()
  }

  if (raw.status === 'unsupported') {
    return unsupportedResult()
  }

  return sanitizeActionableDraft(raw, context)
}
