import { Button } from 'antd-mobile'
import { useState } from 'react'
import type { WorkbenchTodo } from './types'
import TodoAttachmentSection from './TodoAttachmentSection'
import TodoExpenseSection from './TodoExpenseSection'

type TodoCardProps = {
  todo: WorkbenchTodo
  onRefresh: () => Promise<unknown>
  onEdit: (todo: WorkbenchTodo) => void
  onDelete: (todoId: number) => void
  onToggleStatus: (todo: WorkbenchTodo) => void
}

export function TodoCard({ todo, onRefresh, onEdit, onDelete, onToggleStatus }: TodoCardProps) {
  const [expenseExpanded, setExpenseExpanded] = useState(false)
  const [attachmentExpanded, setAttachmentExpanded] = useState(false)

  return (
    <article className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={todo.status === 'completed'}
          onChange={() => onToggleStatus(todo)}
          className="mt-1 h-5 w-5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={`text-base font-semibold text-gray-900 ${todo.status === 'completed' ? 'line-through text-gray-400' : ''}`}>
                {todo.content}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full px-2 py-1 ${
                  todo.status === 'completed'
                    ? 'bg-green-50 text-green-600'
                    : 'bg-yellow-50 text-yellow-700'
                }`}>
                  {todo.status === 'completed' ? '已完成' : '待处理'}
                </span>
                {todo.deadline && (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500">截止 {todo.deadline}</span>
                )}
                {todo.expenses.length > 0 && (
                  <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-600">{todo.expenses.length} 条费用</span>
                )}
                {todo.attachments.length > 0 && (
                  <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-600">{todo.attachments.length} 个附件</span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => onEdit(todo)} className="text-sm text-blue-500">编辑</button>
              <button onClick={() => onDelete(todo.id)} className="text-sm text-red-500">删除</button>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <TodoExpenseSection
              todo={todo}
              expanded={expenseExpanded}
              onToggle={() => setExpenseExpanded((current) => !current)}
              onRefresh={onRefresh}
            />
            <TodoAttachmentSection
              todo={todo}
              expanded={attachmentExpanded}
              onToggle={() => setAttachmentExpanded((current) => !current)}
              onRefresh={onRefresh}
            />
          </div>

          {todo.status !== 'completed' && (
            <div className="mt-4">
              <Button size="small" onClick={() => onToggleStatus(todo)}>
                标记完成
              </Button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export default TodoCard
