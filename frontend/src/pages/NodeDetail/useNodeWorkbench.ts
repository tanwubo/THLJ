import { useEffect, useState } from 'react'
import { timelineAPI } from '../../services/api'
import type { NodeWorkbenchData } from './types'

type RawNode = {
  id: number
  name: string
  description?: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  order: number
  deadline?: string | null
  progress?: number
  created_at?: string
  updated_at?: string
}

type RawTodo = {
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

type RawExpense = {
  id: number
  node_id: number
  todo_id: number
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
  todo_id: number
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  uploader_name?: string | null
  created_at?: string
}

type RawMemo = {
  id: number
  node_id: number
  content: string
  updated_at?: string
}

type RawWorkbench = {
  node: RawNode
  todos: RawTodo[]
  memo: RawMemo | null
}

function normalizeWorkbench(raw: RawWorkbench): NodeWorkbenchData {
  return {
    node: {
      id: raw.node.id,
      name: raw.node.name,
      description: raw.node.description ?? undefined,
      status: raw.node.status,
      order: raw.node.order,
      deadline: raw.node.deadline ?? undefined,
      progress: raw.node.progress ?? 0,
      createdAt: raw.node.created_at ?? '',
      updatedAt: raw.node.updated_at ?? '',
    },
    todos: raw.todos.map((todo) => ({
      id: todo.id,
      nodeId: todo.node_id,
      content: todo.content,
      status: todo.status,
      assigneeId: todo.assignee_id ?? undefined,
      assigneeName: todo.assignee_name ?? undefined,
      deadline: todo.deadline ?? undefined,
      createdAt: todo.created_at ?? '',
      expenses: (todo.expenses ?? []).map((expense) => ({
        id: expense.id,
        nodeId: expense.node_id,
        todoId: expense.todo_id,
        type: expense.type,
        amount: Number(expense.amount),
        category: expense.category,
        description: expense.description ?? undefined,
        creatorName: expense.creator_name ?? undefined,
        createdAt: expense.created_at ?? '',
      })),
      attachments: (todo.attachments ?? []).map((attachment) => ({
        id: attachment.id,
        nodeId: attachment.node_id,
        todoId: attachment.todo_id,
        fileName: attachment.file_name,
        filePath: attachment.file_path,
        fileSize: attachment.file_size,
        fileType: attachment.file_type,
        uploaderName: attachment.uploader_name ?? undefined,
        createdAt: attachment.created_at ?? '',
      })),
    })),
    memo: raw.memo
      ? {
          id: raw.memo.id,
          nodeId: raw.memo.node_id,
          content: raw.memo.content,
          updatedAt: raw.memo.updated_at ?? '',
        }
      : null,
  }
}

export function useNodeWorkbench(nodeId: number) {
  const [data, setData] = useState<NodeWorkbenchData | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const response = await timelineAPI.getWorkbench(nodeId)
    const normalized = normalizeWorkbench(response.data as unknown as RawWorkbench)
    setData(normalized)
    return normalized
  }

  useEffect(() => {
    let active = true

    setLoading(true)
    timelineAPI.getWorkbench(nodeId)
      .then((response) => {
        if (active) {
          setData(normalizeWorkbench(response.data as unknown as RawWorkbench))
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [nodeId])

  return { data, loading, refresh }
}

export default useNodeWorkbench
