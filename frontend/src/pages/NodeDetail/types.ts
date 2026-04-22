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
  node: TimelineNode & {
    budget: number
    expenses: Expense[]
    attachments: Attachment[]
  }
  todos: WorkbenchTodo[]
  memo: Memo | null
}
