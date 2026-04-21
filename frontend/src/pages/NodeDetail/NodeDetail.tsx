import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { memoAPI, timelineAPI, todoAPI } from '../../services/api'
import { Button, Dialog, Toast } from 'antd-mobile'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { buildTodoTemplateDialogConfig } from './todoTemplateDialog'
import { useNodeWorkbench } from './useNodeWorkbench'
import type { WorkbenchTodo } from './types'
import TodoCard from './TodoCard'
import TodoModal from './TodoModal'

export default function NodeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { partnerId, emitRealtimeEvent } = useAuthStore()
  const [memoContent, setMemoContent] = useState('')
  const [savingMemo, setSavingMemo] = useState(false)
  const [todoModalVisible, setTodoModalVisible] = useState(false)
  const [editingTodo, setEditingTodo] = useState<WorkbenchTodo | null>(null)

  const nodeId = parseInt(id || '0', 10)
  const { data, loading, refresh } = useNodeWorkbench(nodeId)

  useEffect(() => {
    setMemoContent(data?.memo?.content || '')
  }, [data?.memo?.content])

  const refreshWorkbench = () => {
    refresh().catch((error) => {
      console.error('刷新工作台失败:', error)
    })
  }

  useRealtimeRefresh(['node_update', 'todo_update', 'expense_update', 'memo_update', 'attachment_update'], refreshWorkbench, Boolean(partnerId))

  const expenseSummary = useMemo(() => {
    const expenses = data?.todos.flatMap((todo) => todo.expenses) ?? []
    const totalIncome = expenses
      .filter((expense) => expense.type === 'income')
      .reduce((sum, expense) => sum + Number(expense.amount), 0)
    const totalExpense = expenses
      .filter((expense) => expense.type === 'expense')
      .reduce((sum, expense) => sum + Number(expense.amount), 0)

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
    }
  }, [data?.todos])

  // 待办操作
  const handleToggleTodo = async (todo: WorkbenchTodo) => {
    const newStatus = todo.status === 'completed' ? 'pending' : 'completed'
    try {
      await todoAPI.updateTodoStatus(todo.id, newStatus)
      emitRealtimeEvent('todo_update', 'status_changed', { id: todo.id, status: newStatus })
      await refresh()
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '更新失败')
    }
  }

  const handleDeleteTodo = async (todoId: number) => {
    try {
      await Dialog.confirm({ content: '确定删除？' })
      await todoAPI.deleteTodo(todoId)
      emitRealtimeEvent('todo_update', 'deleted', { id: todoId })
      await refresh()
      Toast.show('删除成功')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '删除失败')
    }
  }

  const handleAddFromTemplate = async (content: string) => {
    try {
      await todoAPI.createTodo({ nodeId, content })
      emitRealtimeEvent('todo_update', 'created', { nodeId })
      await refresh()
      Toast.show('添加成功')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '添加失败')
    }
  }

  // 备忘录操作
  const handleSaveMemo = async () => {
    setSavingMemo(true)
    try {
      await memoAPI.saveMemo({ nodeId, content: memoContent })
      emitRealtimeEvent('memo_update', 'saved', { nodeId })
      await refresh()
      Toast.show('保存成功')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '保存失败')
    } finally {
      setSavingMemo(false)
    }
  }

  // 节点操作
  const handleStatusChange = async (newStatus: string) => {
    try {
      await timelineAPI.updateNode(nodeId, { status: newStatus })
      emitRealtimeEvent('node_update', 'status_changed', { id: nodeId, status: newStatus })
      await refresh()
      Toast.show('状态已更新')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '更新失败')
    }
  }

  const handleDeleteNode = async () => {
    try {
      await Dialog.confirm({
        content: '确定删除此节点？所有关联数据将被删除',
      })
      await timelineAPI.deleteNode(nodeId)
      emitRealtimeEvent('node_update', 'deleted', { id: nodeId })
      Toast.show('删除成功')
      navigate('/')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '删除失败')
    }
  }

  const handleTodoSubmit = async (values: { content: string; deadline?: string }) => {
    try {
      if (editingTodo) {
        await todoAPI.updateTodo(editingTodo.id, values)
        emitRealtimeEvent('todo_update', 'updated', { id: editingTodo.id })
      } else {
        await todoAPI.createTodo({ nodeId, ...values })
        emitRealtimeEvent('todo_update', 'created', { nodeId })
      }
      await refresh()
      Toast.show(editingTodo ? '待办已更新' : '待办已添加')
      setEditingTodo(null)
      setTodoModalVisible(false)
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '保存待办失败')
      throw error
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">加载中...</div>
  }

  if (!data?.node) {
    return <div className="flex items-center justify-center h-screen">节点不存在</div>
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f7fb]">
      <div className="sticky top-0 z-10 bg-wedding-red px-4 pb-4 pt-4 text-white shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => navigate('/')} className="text-white">← 返回</button>
          <h1 className="mx-2 truncate text-lg font-bold">{data.node.name}</h1>
          <span className={`rounded px-2 py-0.5 text-xs ${
            data.node.status === 'completed' ? 'bg-green-500' :
            data.node.status === 'in_progress' ? 'bg-blue-500' : 'bg-yellow-500'
          }`}>
            {data.node.status === 'completed' ? '已完成' : data.node.status === 'in_progress' ? '进行中' : '待处理'}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/15 px-2 py-3">
            <div className="text-xs text-white/75">待办</div>
            <div className="mt-1 text-lg font-semibold">{data.todos.length}</div>
          </div>
          <div className="rounded-2xl bg-white/15 px-2 py-3">
            <div className="text-xs text-white/75">收入</div>
            <div className="mt-1 text-sm font-semibold">¥{expenseSummary.totalIncome.toFixed(0)}</div>
          </div>
          <div className="rounded-2xl bg-white/15 px-2 py-3">
            <div className="text-xs text-white/75">结余</div>
            <div className="mt-1 text-sm font-semibold">¥{expenseSummary.balance.toFixed(0)}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 pt-4">
        <div className="mb-4 flex gap-2">
          <Button size="small" color="danger" onClick={() => {
            setEditingTodo(null)
            setTodoModalVisible(true)
          }}>
            添加待办
          </Button>
          <Button size="small" onClick={() => {
            Dialog.show(buildTodoTemplateDialogConfig(handleAddFromTemplate))
          }}>
            快捷模板
          </Button>
        </div>

        <div className="space-y-4">
          {data.todos.map((todo) => (
            <TodoCard
              key={todo.id}
              todo={todo}
              onRefresh={refresh}
              onEdit={(selectedTodo) => {
                setEditingTodo(selectedTodo)
                setTodoModalVisible(true)
              }}
              onDelete={handleDeleteTodo}
              onToggleStatus={handleToggleTodo}
            />
          ))}
          {data.todos.length === 0 && (
            <div className="rounded-[24px] border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-400">
              当前节点还没有待办，先添加一个开始推进。
            </div>
          )}
        </div>

        <section className="mt-5 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">备忘录</h2>
            <Button size="small" color="danger" loading={savingMemo} onClick={handleSaveMemo}>
              保存
            </Button>
          </div>
          <textarea
            className="h-40 w-full rounded-2xl border border-gray-200 p-3"
            placeholder="在此记录该节点的关键备注..."
            value={memoContent}
            onChange={(event) => setMemoContent(event.target.value)}
          />
        </section>

        <section className="mt-5 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-base font-semibold text-gray-900">节点操作</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="small" onClick={() => handleStatusChange('in_progress')}>开始</Button>
            <Button size="small" color="success" onClick={() => handleStatusChange('completed')}>完成</Button>
            <Button size="small" onClick={() => handleStatusChange('cancelled')}>取消</Button>
            <Button size="small" color="danger" onClick={handleDeleteNode}>删除节点</Button>
          </div>
        </section>
      </div>

      <TodoModal
        visible={todoModalVisible}
        initialTodo={editingTodo}
        onClose={() => {
          setTodoModalVisible(false)
          setEditingTodo(null)
        }}
        onSubmit={handleTodoSubmit}
      />
    </div>
  )
}
