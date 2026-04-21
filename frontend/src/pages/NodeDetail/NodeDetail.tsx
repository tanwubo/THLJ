import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Dialog, Image, Input, Toast } from 'antd-mobile'
import AppShell from '../../components/layout/AppShell'
import BrandHeader from '../../components/layout/BrandHeader'
import StatusPill from '../../components/ui/StatusPill'
import SurfaceCard from '../../components/ui/SurfaceCard'
import {
  attachmentAPI,
  expenseAPI,
  memoAPI,
  timelineAPI,
  todoAPI,
  type Attachment,
  type Expense,
  type Memo,
  type TimelineNode,
  type Todo,
} from '../../services/api'

const TODO_TEMPLATES = {
  彩礼类: ['沟通彩礼金额', '彩礼转账', '彩礼确认'],
  嫁妆类: ['嫁妆清单', '嫁妆采购'],
  三金类: ['选购三金', '购买三金'],
  婚宴类: ['确定婚宴酒店', '签订婚宴合同', '婚宴菜单确认'],
  婚庆类: ['婚庆公司选择', '婚礼策划确认', '婚礼现场布置'],
  婚车类: ['婚车预约', '婚车路线规划'],
  婚纱类: ['婚纱照拍摄', '婚纱礼服选择'],
} as const

export default function NodeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const nodeId = Number.parseInt(id || '0', 10)

  const [node, setNode] = useState<TimelineNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [todos, setTodos] = useState<Todo[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [expenseStats, setExpenseStats] = useState({ totalIncome: 0, totalExpense: 0, balance: 0 })
  const [memoContent, setMemoContent] = useState('')
  const [savingMemo, setSavingMemo] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [newTodoContent, setNewTodoContent] = useState('')
  const [newTodoDeadline, setNewTodoDeadline] = useState('')
  const [showAddTodo, setShowAddTodo] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [newExpenseType, setNewExpenseType] = useState<'income' | 'expense'>('expense')
  const [newExpenseAmount, setNewExpenseAmount] = useState('')
  const [newExpenseCategory, setNewExpenseCategory] = useState('')
  const [newExpenseDesc, setNewExpenseDesc] = useState('')
  const [expenseCategories, setExpenseCategories] = useState<{ income: string[]; expense: string[] }>({
    income: [],
    expense: [],
  })

  const fetchNode = async () => {
    try {
      const res = await timelineAPI.getTimeline()
      const found = res.data.nodes.find((entry: TimelineNode) => entry.id === nodeId)
      setNode(found || null)
    } catch (error) {
      console.error('获取节点失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTodos = async () => {
    try {
      const res = await todoAPI.getTodos(nodeId)
      setTodos(res.data)
    } catch (error) {
      console.error('获取待办失败:', error)
    }
  }

  const fetchExpenses = async () => {
    try {
      const res = await expenseAPI.getExpenses(nodeId)
      setExpenses(res.data.expenses)
      setExpenseStats(res.data.stats)
      setExpenseCategories(res.data.categories)
    } catch (error) {
      console.error('获取费用失败:', error)
    }
  }

  const fetchMemo = async () => {
    try {
      const res = await memoAPI.getMemo(nodeId)
      const memo: Memo | null = res.data
      setMemoContent(memo?.content || '')
    } catch (error) {
      console.error('获取备忘录失败:', error)
    }
  }

  const fetchAttachments = async () => {
    try {
      const res = await attachmentAPI.getAttachments(nodeId)
      setAttachments(res.data)
    } catch (error) {
      console.error('获取附件失败:', error)
    }
  }

  useEffect(() => {
    void fetchNode()
    void fetchTodos()
    void fetchExpenses()
    void fetchMemo()
    void fetchAttachments()
  }, [nodeId])

  const completedTodos = useMemo(() => todos.filter((todo) => todo.status === 'completed').length, [todos])

  const handleAddTodo = async () => {
    if (!newTodoContent.trim()) {
      Toast.show('请输入待办内容')
      return
    }
    try {
      await todoAPI.createTodo({
        nodeId,
        content: newTodoContent.trim(),
        deadline: newTodoDeadline || undefined,
      })
      setShowAddTodo(false)
      setNewTodoContent('')
      setNewTodoDeadline('')
      await fetchTodos()
      Toast.show('添加成功')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '添加失败')
    }
  }

  const handleToggleTodo = async (todo: Todo) => {
    const newStatus = todo.status === 'completed' ? 'pending' : 'completed'
    try {
      await todoAPI.updateTodoStatus(todo.id, newStatus)
      await fetchTodos()
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '更新失败')
    }
  }

  const handleDeleteTodo = async (todoId: number) => {
    try {
      await Dialog.confirm({ content: '确定删除这个待办吗？' })
      await todoAPI.deleteTodo(todoId)
      await fetchTodos()
      Toast.show('删除成功')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '删除失败')
    }
  }

  const handleAddFromTemplate = async (content: string) => {
    try {
      await todoAPI.createTodo({ nodeId, content })
      await fetchTodos()
      Toast.show('添加成功')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '添加失败')
    }
  }

  const handleAddExpense = async () => {
    if (!newExpenseAmount || !newExpenseCategory) {
      Toast.show('请填写完整信息')
      return
    }
    try {
      await expenseAPI.createExpense({
        nodeId,
        type: newExpenseType,
        amount: Number.parseFloat(newExpenseAmount),
        category: newExpenseCategory,
        description: newExpenseDesc || undefined,
      })
      setShowAddExpense(false)
      setNewExpenseAmount('')
      setNewExpenseCategory('')
      setNewExpenseDesc('')
      await fetchExpenses()
      Toast.show('添加成功')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '添加失败')
    }
  }

  const handleDeleteExpense = async (expenseId: number) => {
    try {
      await Dialog.confirm({ content: '确定删除这条费用记录吗？' })
      await expenseAPI.deleteExpense(expenseId)
      await fetchExpenses()
      Toast.show('删除成功')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '删除失败')
    }
  }

  const handleSaveMemo = async () => {
    setSavingMemo(true)
    try {
      await memoAPI.saveMemo({ nodeId, content: memoContent })
      Toast.show('保存成功')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '保存失败')
    } finally {
      setSavingMemo(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      await attachmentAPI.uploadAttachment(nodeId, file)
      await fetchAttachments()
      Toast.show('上传成功')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '上传失败')
    }

    event.target.value = ''
  }

  const handleDeleteAttachment = async (attachmentId: number) => {
    try {
      await Dialog.confirm({ content: '确定删除附件？' })
      await attachmentAPI.deleteAttachment(attachmentId)
      await fetchAttachments()
      Toast.show('删除成功')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '删除失败')
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      await timelineAPI.updateNode(nodeId, { status: newStatus })
      await fetchNode()
      Toast.show('状态已更新')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '更新失败')
    }
  }

  const handleDeleteNode = async () => {
    try {
      await Dialog.confirm({ content: '确定删除此节点？所有关联数据将被删除。' })
      await timelineAPI.deleteNode(nodeId)
      Toast.show('删除成功')
      navigate('/')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '删除失败')
    }
  }

  if (loading) {
    return <div className="app-loading-screen">加载中...</div>
  }

  if (!node) {
    return <div className="app-loading-screen">节点不存在</div>
  }

  return (
    <AppShell
      header={
        <BrandHeader
          eyebrow="Node Workbook"
          title={node.name}
          subtitle={node.description || '围绕这个阶段集中推进待办、预算、备注与附件。'}
          aside={<StatusPill status={node.status} />}
        />
      }
    >
      <div className="node-detail-page">
        <SurfaceCard className="node-summary-grid">
          <div className="stats-metric-card">
            <span>待办</span>
            <strong>{todos.length}</strong>
          </div>
          <div className="stats-metric-card">
            <span>已完成</span>
            <strong>{completedTodos}</strong>
          </div>
          <div className="stats-metric-card">
            <span>收入</span>
            <strong>¥{expenseStats.totalIncome.toFixed(0)}</strong>
          </div>
          <div className="stats-metric-card">
            <span>结余</span>
            <strong>¥{expenseStats.balance.toFixed(0)}</strong>
          </div>
        </SurfaceCard>

        <SurfaceCard className="settings-section">
          <p className="section-label">Todos</p>
          <h2 className="section-title">待办推进</h2>
          <div className="timeline-form-actions">
            <button type="button" className="brand-primary-button" onClick={() => setShowAddTodo((value) => !value)}>
              添加待办
            </button>
            {Object.entries(TODO_TEMPLATES).map(([category, items]) => (
              <button
                key={category}
                type="button"
                className="brand-secondary-button"
                onClick={() => void handleAddFromTemplate(items[0])}
              >
                {category}
              </button>
            ))}
          </div>
          {showAddTodo ? (
            <div className="timeline-form-grid">
              <label className="auth-form__field">
                <span>待办内容</span>
                <Input placeholder="例如：确认婚礼司仪" value={newTodoContent} onChange={setNewTodoContent} />
              </label>
              <label className="auth-form__field">
                <span>截止日期</span>
                <Input type="date" value={newTodoDeadline} onChange={setNewTodoDeadline} />
              </label>
              <div className="timeline-form-actions">
                <button type="button" className="brand-secondary-button" onClick={() => setShowAddTodo(false)}>
                  取消
                </button>
                <button type="button" className="brand-primary-button" onClick={() => void handleAddTodo()}>
                  添加
                </button>
              </div>
            </div>
          ) : null}
          <div className="node-list">
            {todos.length === 0 ? (
              <p className="section-copy">暂无待办，先添加一个开始推进。</p>
            ) : (
              todos.map((todo) => (
                <div key={todo.id} className="node-list-item">
                  <button type="button" className="node-list-item__check" onClick={() => void handleToggleTodo(todo)}>
                    {todo.status === 'completed' ? '已完成' : '待处理'}
                  </button>
                  <div className="node-list-item__body">
                    <strong>{todo.content}</strong>
                    {todo.deadline ? <span>截止：{todo.deadline}</span> : null}
                  </div>
                  <button type="button" className="brand-inline-button brand-inline-button--danger" onClick={() => void handleDeleteTodo(todo.id)}>
                    删除
                  </button>
                </div>
              ))
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard className="settings-section">
          <p className="section-label">Expenses</p>
          <h2 className="section-title">预算与支出</h2>
          <div className="timeline-form-actions">
            <button type="button" className="brand-primary-button" onClick={() => setShowAddExpense((value) => !value)}>
              添加费用
            </button>
            <span className="section-copy">
              分类建议：{(newExpenseType === 'income' ? expenseCategories.income : expenseCategories.expense).join('、')}
            </span>
          </div>
          {showAddExpense ? (
            <div className="timeline-form-grid">
              <div className="timeline-form-actions">
                <button type="button" className={newExpenseType === 'income' ? 'brand-primary-button' : 'brand-secondary-button'} onClick={() => setNewExpenseType('income')}>
                  收入
                </button>
                <button type="button" className={newExpenseType === 'expense' ? 'brand-primary-button' : 'brand-secondary-button'} onClick={() => setNewExpenseType('expense')}>
                  支出
                </button>
              </div>
              <label className="auth-form__field">
                <span>金额</span>
                <Input type="number" value={newExpenseAmount} onChange={setNewExpenseAmount} />
              </label>
              <label className="auth-form__field">
                <span>分类</span>
                <Input value={newExpenseCategory} onChange={setNewExpenseCategory} />
              </label>
              <label className="auth-form__field">
                <span>描述</span>
                <Input value={newExpenseDesc} onChange={setNewExpenseDesc} />
              </label>
              <div className="timeline-form-actions">
                <button type="button" className="brand-secondary-button" onClick={() => setShowAddExpense(false)}>
                  取消
                </button>
                <button type="button" className="brand-primary-button" onClick={() => void handleAddExpense()}>
                  保存费用
                </button>
              </div>
            </div>
          ) : null}
          <div className="node-list">
            {expenses.length === 0 ? (
              <p className="section-copy">暂无费用记录。</p>
            ) : (
              expenses.map((expense) => (
                <div key={expense.id} className="node-list-item">
                  <div className="node-list-item__body">
                    <strong>{expense.type === 'income' ? '+' : '-'}¥{Number(expense.amount).toFixed(2)}</strong>
                    <span>{expense.category}{expense.description ? ` · ${expense.description}` : ''}</span>
                  </div>
                  <button type="button" className="brand-inline-button brand-inline-button--danger" onClick={() => void handleDeleteExpense(expense.id)}>
                    删除
                  </button>
                </div>
              ))
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard className="settings-section">
          <p className="section-label">Memo</p>
          <h2 className="section-title">备忘录</h2>
          <textarea
            className="themed-textarea"
            placeholder="记录这个阶段的重点提醒、联系人或注意事项"
            value={memoContent}
            onChange={(event) => setMemoContent(event.target.value)}
          />
          <div className="timeline-form-actions">
            <button type="button" className="brand-primary-button" onClick={() => void handleSaveMemo()}>
              {savingMemo ? '保存中...' : '保存备忘录'}
            </button>
          </div>
        </SurfaceCard>

        <SurfaceCard className="settings-section">
          <p className="section-label">Attachments</p>
          <h2 className="section-title">附件资料</h2>
          <label className="attachment-upload">
            <span className="brand-secondary-button">上传附件</span>
            <input type="file" onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx" />
          </label>
          <div className="node-list">
            {attachments.length === 0 ? (
              <p className="section-copy">暂无附件。</p>
            ) : (
              attachments.map((attachment) => (
                <div key={attachment.id} className="node-list-item">
                  {attachment.fileType.startsWith('image/') ? (
                    <Image src={attachment.filePath} width={48} height={48} fit="cover" />
                  ) : (
                    <div className="attachment-placeholder">文档</div>
                  )}
                  <div className="node-list-item__body">
                    <strong>{attachment.fileName}</strong>
                    <span>{(attachment.fileSize / 1024).toFixed(1)} KB</span>
                  </div>
                  <button type="button" className="brand-inline-button brand-inline-button--danger" onClick={() => void handleDeleteAttachment(attachment.id)}>
                    删除
                  </button>
                </div>
              ))
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard className="settings-section">
          <p className="section-label">Actions</p>
          <h2 className="section-title">节点操作</h2>
          <div className="timeline-form-actions">
            <button type="button" className="brand-secondary-button" onClick={() => void handleStatusChange('in_progress')}>
              开始
            </button>
            <button type="button" className="brand-primary-button" onClick={() => void handleStatusChange('completed')}>
              完成
            </button>
            <button type="button" className="brand-secondary-button" onClick={() => void handleStatusChange('cancelled')}>
              取消
            </button>
            <button type="button" className="brand-inline-button brand-inline-button--danger" onClick={() => void handleDeleteNode()}>
              删除节点
            </button>
          </div>
        </SurfaceCard>
      </div>
    </AppShell>
  )
}
