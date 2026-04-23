import { useEffect, useMemo, useRef, useState } from 'react'
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
import type { NodeWorkbenchData, WorkbenchTodo } from './types'
import { useNodeWorkbench } from './useNodeWorkbench'

function formatCurrencyAmount(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2).replace(/\.?0+$/, '')
}

export default function NodeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { partnerId, emitRealtimeEvent } = useAuthStore()
  const [memoContent, setMemoContent] = useState('')
  const [savingMemo, setSavingMemo] = useState(false)
  const [todoModalVisible, setTodoModalVisible] = useState(false)
  const [editingTodo, setEditingTodo] = useState<WorkbenchTodo | null>(null)
  const [budgetDraft, setBudgetDraft] = useState('')
  const [isBudgetEditing, setIsBudgetEditing] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<NodeWorkbenchData['node']['attachments'][number] | null>(null)
  const budgetInputRef = useRef<HTMLInputElement | null>(null)
  const budgetSaveInFlightRef = useRef(false)
  const skipBudgetBlurSaveRef = useRef(false)

  const nodeId = parseInt(id || '0', 10)
  const { data, loading, refresh } = useNodeWorkbench(nodeId)

  useEffect(() => {
    setMemoContent(data?.memo?.content || '')
  }, [data?.memo?.content])

  useEffect(() => {
    if (!isBudgetEditing || !budgetInputRef.current) {
      return
    }

    budgetInputRef.current.focus()
    budgetInputRef.current.select()
  }, [isBudgetEditing])

  const refreshWorkbench = () => {
    refresh().catch((error) => {
      console.error('刷新工作台失败:', error)
    })
  }

  useRealtimeRefresh(['node_update', 'todo_update', 'expense_update', 'memo_update', 'attachment_update'], refreshWorkbench, Boolean(partnerId))

  const expenseSummary = useMemo(() => {
    const expenses = [
      ...(data?.node.expenses ?? []),
      ...(data?.todos.flatMap((todo) => todo.expenses) ?? []),
    ]
    const totalIncome = expenses
      .filter((expense) => expense.type === 'income')
      .reduce((sum, expense) => sum + Number(expense.amount), 0)
    const totalExpense = expenses
      .filter((expense) => expense.type === 'expense')
      .reduce((sum, expense) => sum + Number(expense.amount), 0)

    return {
      totalIncome,
      totalExpense,
    }
  }, [data?.node.expenses, data?.todos])

  const legacyRecordCount = (data?.node.expenses.length ?? 0) + (data?.node.attachments.length ?? 0)

  const isExpenseWarning = Boolean(data?.node.budget && data.node.budget > 0 && expenseSummary.totalExpense > data.node.budget * 0.8)

  const handleToggleTodo = async (todo: WorkbenchTodo) => {
    const newStatus = todo.status === 'completed' ? 'pending' : 'completed'
    try {
      await todoAPI.updateTodoStatus(todo.id, newStatus)
      emitRealtimeEvent('todo_update', 'status_changed', { id: todo.id, status: newStatus })
      const remainingUnfinishedTodos = data?.todos.filter((item) => item.id !== todo.id && item.status !== 'completed') ?? []
      const shouldPromptCompleteNode =
        newStatus === 'completed' &&
        remainingUnfinishedTodos.length === 0 &&
        data?.node.status !== 'completed'

      if (shouldPromptCompleteNode) {
        await new Promise<void>((resolve) => {
          Dialog.show({
            content: '最后一个未完成待办已完成，是否将节点状态设为已完成？',
            closeOnAction: true,
            actions: [
              {
                key: 'confirm',
                text: '确定',
                onClick: async () => {
                  try {
                    await timelineAPI.updateNode(nodeId, { status: 'completed' })
                    emitRealtimeEvent('node_update', 'status_changed', { id: nodeId, status: 'completed' })
                  } catch (error: any) {
                    Toast.show(error.response?.data?.error || '更新失败')
                  }
                },
              },
              { key: 'cancel', text: '取消' },
            ],
            onClose: () => resolve(),
          })
        })
      }
      await refresh()
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '更新失败')
    }
  }

  const handleDeleteTodo = async (todoId: number) => {
    const confirmed = await Dialog.confirm({ content: '确定删除？' }).then(() => true).catch(() => false)
    if (!confirmed) {
      return
    }

    try {
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

  const openBudgetEditor = () => {
    setBudgetDraft(String(data?.node.budget ?? 0))
    skipBudgetBlurSaveRef.current = false
    setIsBudgetEditing(true)
  }

  const cancelBudgetEdit = () => {
    setBudgetDraft(String(data?.node.budget ?? 0))
    skipBudgetBlurSaveRef.current = false
    setIsBudgetEditing(false)
  }

  const saveBudget = async () => {
    if (budgetSaveInFlightRef.current) {
      return
    }

    const nextBudget = budgetDraft.trim() === '' ? 0 : Number(budgetDraft)
    if (!Number.isFinite(nextBudget) || nextBudget < 0) {
      Toast.show('预算必须是大于等于 0 的数字')
      return
    }

    budgetSaveInFlightRef.current = true
    try {
      await timelineAPI.updateNode(nodeId, { budget: nextBudget })
      emitRealtimeEvent('node_update', 'updated', { id: nodeId, budget: nextBudget })
      setIsBudgetEditing(false)
      await refresh()
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '更新失败')
    } finally {
      budgetSaveInFlightRef.current = false
    }
  }

  const handleDeleteNode = async () => {
    const confirmed = await Dialog.confirm({
      content: '确定删除此节点？所有关联数据将被删除',
    }).then(() => true).catch(() => false)
    if (!confirmed) {
      return
    }

    try {
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

  const handleAttachmentOpen = (attachment: NodeWorkbenchData['node']['attachments'][number]) => {
    if (attachment.fileType.startsWith('image/')) {
      setPreviewAttachment(attachment)
      return
    }

    const link = document.createElement('a')
    link.href = attachment.filePath
    link.download = attachment.fileName
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
          aside={<StatusPill status={data.node.status} inverse />}
        />
      }
    >
      <div className="node-detail-page">
        <SurfaceCard className="node-summary-grid">
          <div className="stats-metric-card">
            <span>预算</span>
            {isBudgetEditing ? (
              <input
                ref={budgetInputRef}
                aria-label="编辑预算"
                className="timeline-inline-input"
                value={budgetDraft}
                inputMode="decimal"
                onChange={(event) => setBudgetDraft(event.target.value)}
                onBlur={() => {
                  if (skipBudgetBlurSaveRef.current) {
                    skipBudgetBlurSaveRef.current = false
                    return
                  }
                  void saveBudget()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    skipBudgetBlurSaveRef.current = true
                    void saveBudget()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    cancelBudgetEdit()
                  }
                }}
              />
            ) : (
              <button type="button" className="text-left" onClick={openBudgetEditor}>
                <strong>¥{formatCurrencyAmount(data.node.budget)}</strong>
              </button>
            )}
          </div>
          <div
            className={`stats-metric-card${isExpenseWarning ? ' stats-metric-card--warning' : ''}`}
            data-testid="node-total-expense"
          >
            <span>总支出</span>
            <strong>¥{formatCurrencyAmount(expenseSummary.totalExpense)}</strong>
          </div>
          <div className="stats-metric-card">
            <span>总收入</span>
            <strong>¥{formatCurrencyAmount(expenseSummary.totalIncome)}</strong>
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

        {legacyRecordCount > 0 ? (
          <SurfaceCard className="settings-section">
            <div className="mb-3">
              <h2 className="section-title">兼容旧版节点记录</h2>
              <p className="section-copy">以下内容来自迁移前直接挂在节点上的旧版费用与附件记录。</p>
            </div>

            {data.node.expenses.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-900">旧版节点费用</div>
                {data.node.expenses.map((expense) => (
                  <div key={`legacy-expense-${expense.id}`} className="rounded-xl bg-white px-3 py-3 shadow-sm">
                    <div className={`text-sm font-semibold ${expense.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {expense.type === 'income' ? '+' : '-'}¥{formatCurrencyAmount(Number(expense.amount))}
                    </div>
                    <div className="mt-1 text-sm text-gray-700">{expense.category}</div>
                    {expense.description ? <div className="mt-1 text-xs text-gray-400">{expense.description}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}

            {data.node.attachments.length > 0 ? (
              <div className={`space-y-2${data.node.expenses.length > 0 ? ' mt-4' : ''}`}>
                <div className="text-sm font-medium text-gray-900">旧版节点附件</div>
                {data.node.attachments.map((attachment) => (
                  <button
                    key={`legacy-attachment-${attachment.id}`}
                    type="button"
                    aria-label={`${attachment.fileType.startsWith('image/') ? '预览附件' : '下载附件'} ${attachment.fileName}`}
                    className="flex w-full items-center gap-3 rounded-xl bg-white px-3 py-3 text-left shadow-sm"
                    onClick={() => handleAttachmentOpen(attachment)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-800">{attachment.fileName}</div>
                      <div className="mt-1 text-xs text-gray-400">{(attachment.fileSize / 1024).toFixed(1)} KB</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </SurfaceCard>
        ) : null}
      </div>

      <Dialog
        visible={previewAttachment !== null}
        content={
          previewAttachment ? (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-gray-900">{previewAttachment.fileName}</div>
              <img
                src={previewAttachment.filePath}
                alt={previewAttachment.fileName}
                className="max-h-[70vh] w-full rounded-2xl object-contain"
              />
            </div>
          ) : null
        }
        closeOnAction
        actions={[{ key: 'close', text: '关闭' }]}
        onClose={() => setPreviewAttachment(null)}
      />

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
