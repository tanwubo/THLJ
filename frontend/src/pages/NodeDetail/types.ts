import type { Attachment, Expense, Memo, TimelineNode, Todo } from '../../services/api'

export type WorkbenchExpense = Expense & {
  todoId: number
}

export type WorkbenchAttachment = Attachment & {
  todoId: number
}

export type WorkbenchTodo = Todo & {
  expenses: WorkbenchExpense[]
  attachments: WorkbenchAttachment[]
}

export type NodeWorkbenchData = {
  node: TimelineNode
  todos: WorkbenchTodo[]
  memo: Memo | null
}
