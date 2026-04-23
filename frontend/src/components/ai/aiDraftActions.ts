import type {
  AiParseCommandResponse,
  expenseAPI,
  timelineAPI,
  todoAPI,
} from '../../services/api'

type TimelineApi = typeof timelineAPI
type TodoApi = typeof todoAPI
type ExpenseApi = typeof expenseAPI

type EmitRealtimeEvent = (event: string, action: string, payload?: any) => void

interface ConfirmAiDraftInput {
  result: AiParseCommandResponse
  timelineAPI: TimelineApi
  todoAPI: TodoApi
  expenseAPI: ExpenseApi
  emitRealtimeEvent: EmitRealtimeEvent
}

export async function confirmAiDraft({
  result,
  timelineAPI,
  todoAPI,
  expenseAPI,
  emitRealtimeEvent,
}: ConfirmAiDraftInput): Promise<void> {
  if (result.status !== 'ready' || !result.draft) {
    throw new Error('请先补全信息')
  }

  const { draft } = result

  if (draft.actionType === 'create_node') {
    const name = draft.fields.name?.trim()
    if (!name) {
      throw new Error('节点名称不能为空')
    }

    await timelineAPI.createNode({
      name,
      description: draft.fields.description,
      deadline: draft.fields.deadline,
      budget: draft.fields.budget,
    })
    emitRealtimeEvent('node_update', 'created')
    return
  }

  if (draft.actionType === 'create_todo') {
    const nodeId = draft.fields.nodeId
    const content = draft.fields.content?.trim()
    if (!nodeId || !content) {
      throw new Error('待办信息不完整')
    }

    await todoAPI.createTodo({
      nodeId,
      content,
      deadline: draft.fields.deadline,
    })
    emitRealtimeEvent('todo_update', 'created', { nodeId })
    return
  }

  if (draft.actionType === 'create_expense') {
    const todoId = draft.fields.todoId
    const type = draft.fields.type
    const amount = draft.fields.amount
    if (!todoId || !type || typeof amount !== 'number') {
      throw new Error('费用信息不完整')
    }

    await expenseAPI.createExpense({
      todoId,
      type,
      amount,
      category: draft.fields.category,
      description: draft.fields.description,
    })
    emitRealtimeEvent('expense_update', 'created', { todoId })
    return
  }

  throw new Error('请先补全信息')
}
