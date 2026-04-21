import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Dialog, Toast } from 'antd-mobile'
import AppShell from '../../components/layout/AppShell'
import BrandHeader from '../../components/layout/BrandHeader'
import StatusPill from '../../components/ui/StatusPill'
import SurfaceCard from '../../components/ui/SurfaceCard'
import { useAuthStore } from '../../store/authStore'
import { memoAPI, timelineAPI, todoAPI } from '../../services/api'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { buildTodoTemplateDialogConfig } from './todoTemplateDialog'
import TodoCard from './TodoCard'
import TodoModal from './TodoModal'
import type { WorkbenchTodo } from './types'
import { useNodeWorkbench } from './useNodeWorkbench'

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

  const completedTodos = useMemo(
    () => data?.todos.filter((todo) => todo.status === 'completed').length ?? 0,
    [data?.todos],
  )

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
    return <div className="app-loading-screen">加载中...</div>
  }

  if (!data?.node) {
    return <div className="app-loading-screen">节点不存在</div>
  }

  return (
    <AppShell
      header={
        <BrandHeader
          eyebrow="Node Workbook"
          title={data.node.name}
          subtitle={data.node.description || '围绕这个阶段集中推进待办、预算与关键备注。'}
          aside={<StatusPill status={data.node.status} />}
        />
      }
    >
      <div className="node-detail-page">
        <SurfaceCard className="node-summary-grid">
          <div className="stats-metric-card">
            <span>待办</span>
            <strong>{data.todos.length}</strong>
          </div>
          <div className="stats-metric-card">
            <span>已完成</span>
            <strong>{completedTodos}</strong>
          </div>
          <div className="stats-metric-card">
            <span>收入</span>
            <strong>¥{expenseSummary.totalIncome.toFixed(0)}</strong>
          </div>
          <div className="stats-metric-card">
            <span>结余</span>
            <strong>¥{expenseSummary.balance.toFixed(0)}</strong>
          </div>
        </SurfaceCard>

        <SurfaceCard className="settings-section">
          <div className="timeline-form-actions">
            <button
              type="button"
              className="brand-primary-button"
              onClick={() => {
                setEditingTodo(null)
                setTodoModalVisible(true)
              }}
            >
              添加待办
            </button>
            <button
              type="button"
              className="brand-secondary-button"
              onClick={() => {
                Dialog.show(buildTodoTemplateDialogConfig(handleAddFromTemplate))
              }}
            >
              快捷模板
            </button>
          </div>

          <div className="node-list">
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
        </SurfaceCard>

        <SurfaceCard className="settings-section">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">备忘录</h2>
            <button type="button" className="brand-primary-button" onClick={handleSaveMemo}>
              {savingMemo ? '保存中...' : '保存'}
            </button>
          </div>
          <textarea
            className="themed-textarea"
            placeholder="在此记录该节点的关键备注..."
            value={memoContent}
            onChange={(event) => setMemoContent(event.target.value)}
          />
        </SurfaceCard>

        <SurfaceCard className="settings-section">
          <h2 className="section-title">节点操作</h2>
          <div className="timeline-form-actions">
            <button type="button" className="brand-secondary-button" onClick={() => handleStatusChange('in_progress')}>
              开始
            </button>
            <button type="button" className="brand-primary-button" onClick={() => handleStatusChange('completed')}>
              完成
            </button>
            <button type="button" className="brand-secondary-button" onClick={() => handleStatusChange('cancelled')}>
              取消
            </button>
            <button type="button" className="brand-inline-button brand-inline-button--danger" onClick={handleDeleteNode}>
              删除节点
            </button>
          </div>
        </SurfaceCard>
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
    </AppShell>
  )
}
