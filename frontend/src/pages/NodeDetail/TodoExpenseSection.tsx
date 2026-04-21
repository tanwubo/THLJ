import { Button, Dialog, Input, Popup, Toast } from 'antd-mobile'
import { useMemo, useState } from 'react'
import { expenseAPI } from '../../services/api'
import type { WorkbenchTodo } from './types'

type TodoExpenseSectionProps = {
  todo: WorkbenchTodo
  expanded: boolean
  onToggle: () => void
  onRefresh: () => Promise<unknown>
}

export function TodoExpenseSection({ todo, expanded, onToggle, onRefresh }: TodoExpenseSectionProps) {
  const [visible, setVisible] = useState(false)
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const summary = useMemo(() => {
    const income = todo.expenses
      .filter((expense) => expense.type === 'income')
      .reduce((total, expense) => total + Number(expense.amount), 0)
    const expense = todo.expenses
      .filter((item) => item.type === 'expense')
      .reduce((total, item) => total + Number(item.amount), 0)

    return {
      count: todo.expenses.length,
      income,
      expense,
    }
  }, [todo.expenses])

  const resetForm = () => {
    setType('expense')
    setAmount('')
    setCategory('')
    setDescription('')
  }

  const handleCreate = async () => {
    if (!amount || !category.trim()) {
      Toast.show('请填写完整费用信息')
      return
    }

    setSubmitting(true)
    try {
      await expenseAPI.createExpense({
        todoId: todo.id,
        type,
        amount: Number(amount),
        category: category.trim(),
        description: description.trim() || undefined,
      })
      Toast.show('费用已添加')
      setVisible(false)
      resetForm()
      await onRefresh()
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '添加费用失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (expenseId: number) => {
    try {
      await Dialog.confirm({ content: '确定删除该费用记录？' })
      await expenseAPI.deleteExpense(expenseId)
      Toast.show('删除成功')
      await onRefresh()
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '删除失败')
    }
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-gray-900">费用</div>
          <div className="mt-1 text-xs text-gray-500">
            {summary.count} 条，收入 ¥{summary.income.toFixed(2)}，支出 ¥{summary.expense.toFixed(2)}
          </div>
        </div>
        <Button size="small" fill="none" onClick={onToggle}>
          {expanded ? '收起' : '展开'}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          <Button size="small" color="danger" onClick={() => setVisible(true)}>
            添加该待办费用
          </Button>
          {todo.expenses.length === 0 ? (
            <div className="rounded-xl bg-white px-3 py-4 text-sm text-gray-400">暂无费用记录</div>
          ) : (
            todo.expenses.map((expense) => (
              <div key={expense.id} className="rounded-xl bg-white px-3 py-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={`text-sm font-semibold ${expense.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {expense.type === 'income' ? '+' : '-'}¥{Number(expense.amount).toFixed(2)}
                    </div>
                    <div className="mt-1 text-sm text-gray-700">{expense.category}</div>
                    {expense.description && (
                      <div className="mt-1 text-xs text-gray-400">{expense.description}</div>
                    )}
                  </div>
                  <button onClick={() => handleDelete(expense.id)} className="text-sm text-red-500">
                    删除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Popup visible={visible} onMaskClick={() => setVisible(false)} bodyStyle={{ borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
        <div className="space-y-4 p-4">
          <div className="text-lg font-semibold text-gray-900">添加费用</div>
          <div className="flex gap-2">
            <Button size="small" color={type === 'expense' ? 'danger' : 'default'} onClick={() => setType('expense')}>
              支出
            </Button>
            <Button size="small" color={type === 'income' ? 'success' : 'default'} onClick={() => setType('income')}>
              收入
            </Button>
          </div>
          <Input placeholder="金额" value={amount} onChange={setAmount} type="number" clearable />
          <Input placeholder="分类" value={category} onChange={setCategory} clearable />
          <Input placeholder="描述（可选）" value={description} onChange={setDescription} clearable />
          <div className="flex gap-3">
            <Button block onClick={() => setVisible(false)}>
              取消
            </Button>
            <Button block color="danger" loading={submitting} onClick={handleCreate}>
              保存
            </Button>
          </div>
        </div>
      </Popup>
    </section>
  )
}

export default TodoExpenseSection
