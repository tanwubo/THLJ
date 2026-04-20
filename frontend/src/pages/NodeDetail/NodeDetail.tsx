import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { timelineAPI, todoAPI, expenseAPI, memoAPI, attachmentAPI, TimelineNode, Todo, Expense, Memo, Attachment } from '../../services/api'
import { Button, Toast, Dialog, Input, Tabs, Image } from 'antd-mobile'

// 待办模板
const TODO_TEMPLATES = {
  '彩礼类': ['沟通彩礼金额', '彩礼转账', '彩礼确认'],
  '嫁妆类': ['嫁妆清单', '嫁妆采购'],
  '三金类': ['选购三金', '购买三金'],
  '婚宴类': ['确定婚宴酒店', '签订婚宴合同', '婚宴菜单确认'],
  '婚庆类': ['婚庆公司选择', '婚礼策划确认', '婚礼现场布置'],
  '婚车类': ['婚车预约', '婚车路线规划'],
  '婚纱类': ['婚纱照拍摄', '婚纱礼服选择'],
}

export default function NodeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, partnerId } = useAuthStore()

  const [node, setNode] = useState<TimelineNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('todos')

  // 待办相关
  const [todos, setTodos] = useState<Todo[]>([])
  const [showAddTodo, setShowAddTodo] = useState(false)
  const [newTodoContent, setNewTodoContent] = useState('')
  const [newTodoDeadline, setNewTodoDeadline] = useState('')

  // 费用相关
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [expenseStats, setExpenseStats] = useState({ totalIncome: 0, totalExpense: 0, balance: 0 })
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [newExpenseType, setNewExpenseType] = useState<'income' | 'expense'>('expense')
  const [newExpenseAmount, setNewExpenseAmount] = useState('')
  const [newExpenseCategory, setNewExpenseCategory] = useState('')
  const [newExpenseDesc, setNewExpenseDesc] = useState('')
  const [expenseCategories, setExpenseCategories] = useState<{ income: string[]; expense: string[] }>({ income: [], expense: [] })

  // 备忘录相关
  const [memo, setMemo] = useState<Memo | null>(null)
  const [memoContent, setMemoContent] = useState('')
  const [savingMemo, setSavingMemo] = useState(false)

  // 附件相关
  const [attachments, setAttachments] = useState<Attachment[]>([])

  const nodeId = parseInt(id || '0', 10)

  const fetchNode = async () => {
    try {
      const res = await timelineAPI.getTimeline()
      const found = res.data.nodes.find((n: any) => n.id === nodeId)
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
      setMemo(res.data)
      setMemoContent(res.data?.content || '')
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
    fetchNode()
    fetchTodos()
    fetchExpenses()
    fetchMemo()
    fetchAttachments()
  }, [nodeId])

  // 待办操作
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
      fetchTodos()
      Toast.show('添加成功')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '添加失败')
    }
  }

  const handleToggleTodo = async (todo: Todo) => {
    const newStatus = todo.status === 'completed' ? 'pending' : 'completed'
    try {
      await todoAPI.updateTodoStatus(todo.id, newStatus)
      fetchTodos()
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '更新失败')
    }
  }

  const handleDeleteTodo = async (todoId: number) => {
    try {
      await Dialog.confirm({ content: '确定删除？' })
      await todoAPI.deleteTodo(todoId)
      fetchTodos()
      Toast.show('删除成功')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '删除失败')
    }
  }

  const handleAddFromTemplate = async (content: string) => {
    try {
      await todoAPI.createTodo({ nodeId, content })
      fetchTodos()
      Toast.show('添加成功')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '添加失败')
    }
  }

  // 费用操作
  const handleAddExpense = async () => {
    if (!newExpenseAmount || !newExpenseCategory) {
      Toast.show('请填写完整信息')
      return
    }
    try {
      await expenseAPI.createExpense({
        nodeId,
        type: newExpenseType,
        amount: parseFloat(newExpenseAmount),
        category: newExpenseCategory,
        description: newExpenseDesc || undefined,
      })
      setShowAddExpense(false)
      setNewExpenseAmount('')
      setNewExpenseCategory('')
      setNewExpenseDesc('')
      fetchExpenses()
      Toast.show('添加成功')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '添加失败')
    }
  }

  const handleDeleteExpense = async (expenseId: number) => {
    try {
      await Dialog.confirm({ content: '确定删除？' })
      await expenseAPI.deleteExpense(expenseId)
      fetchExpenses()
      Toast.show('删除成功')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '删除失败')
    }
  }

  // 备忘录操作
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

  // 附件操作
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      await attachmentAPI.uploadAttachment(nodeId, file)
      fetchAttachments()
      Toast.show('上传成功')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '上传失败')
    }
    e.target.value = ''
  }

  const handleDeleteAttachment = async (attachmentId: number) => {
    try {
      await Dialog.confirm({ content: '确定删除附件？' })
      await attachmentAPI.deleteAttachment(attachmentId)
      fetchAttachments()
      Toast.show('删除成功')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '删除失败')
    }
  }

  // 节点操作
  const handleStatusChange = async (newStatus: string) => {
    try {
      await timelineAPI.updateNode(nodeId, { status: newStatus })
      fetchNode()
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
      Toast.show('删除成功')
      navigate('/')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '删除失败')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">加载中...</div>
  }

  if (!node) {
    return <div className="flex items-center justify-center h-screen">节点不存在</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* 头部 */}
      <div className="bg-wedding-red text-white p-4">
        <div className="flex justify-between items-center">
          <button onClick={() => navigate('/')} className="text-white">← 返回</button>
          <h1 className="text-lg font-bold truncate ml-2 mr-2">{node.name}</h1>
          <span className={`text-xs px-2 py-0.5 rounded ${
            node.status === 'completed' ? 'bg-green-500' :
            node.status === 'in_progress' ? 'bg-blue-500' : 'bg-yellow-500'
          }`}>
            {node.status === 'completed' ? '已完成' : node.status === 'in_progress' ? '进行中' : '待处理'}
          </span>
        </div>
      </div>

      {/* Tab 内容 */}
      <Tabs activeKey={activeTab} onChange={setActiveTab} className="bg-white">
        <Tabs.Tab title="待办" key="todos">
          <div className="p-4">
            {/* 添加待办按钮 */}
            <div className="flex gap-2 mb-4">
              <Button size="small" onClick={() => setShowAddTodo(true)}>✏️ 添加待办</Button>
              <Button size="small" onClick={() => {
                const templates = Object.entries(TODO_TEMPLATES)
                const actions = templates.flatMap(([cat, items]) => items.map(item => `${cat}: ${item}`))
                Dialog.show({
                  actions: actions.map(text => ({ text, onPress: () => handleAddFromTemplate(text.split(': ')[1]) }))
                })
              }}>📋 快捷模板</Button>
            </div>

            {/* 添加待办表单 */}
            {showAddTodo && (
              <div className="bg-white rounded-lg p-3 mb-4 shadow-sm">
                <Input placeholder="待办内容" value={newTodoContent} onChange={setNewTodoContent} />
                <Input type="date" placeholder="截止日期" className="mt-2" value={newTodoDeadline} onChange={setNewTodoDeadline} />
                <div className="flex gap-2 mt-2">
                  <Button size="small" onClick={() => setShowAddTodo(false)}>取消</Button>
                  <Button size="small" color="danger" onClick={handleAddTodo}>添加</Button>
                </div>
              </div>
            )}

            {/* 待办列表 */}
            <div className="space-y-2">
              {todos.map(todo => (
                <div key={todo.id} className="bg-white rounded-lg p-3 flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={todo.status === 'completed'}
                    onChange={() => handleToggleTodo(todo)}
                    className="w-5 h-5"
                  />
                  <div className="flex-1">
                    <span className={todo.status === 'completed' ? 'line-through text-gray-400' : ''}>{todo.content}</span>
                    {todo.assigneeName && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded ml-2">{todo.assigneeName}</span>
                    )}
                    {todo.deadline && (
                      <span className="text-xs text-gray-400 ml-2">📅 {todo.deadline}</span>
                    )}
                  </div>
                  <button onClick={() => handleDeleteTodo(todo.id)} className="text-red-500 text-sm">删除</button>
                </div>
              ))}
              {todos.length === 0 && <div className="text-center text-gray-400 py-8">暂无待办</div>}
            </div>
          </div>
        </Tabs.Tab>

        <Tabs.Tab title="费用" key="expenses">
          <div className="p-4">
            {/* 费用统计 */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-xs text-green-600">收入</div>
                <div className="text-lg font-bold text-green-600">¥{expenseStats.totalIncome.toFixed(2)}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-xs text-red-600">支出</div>
                <div className="text-lg font-bold text-red-600">¥{expenseStats.totalExpense.toFixed(2)}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-xs text-blue-600">结余</div>
                <div className="text-lg font-bold text-blue-600">¥{expenseStats.balance.toFixed(2)}</div>
              </div>
            </div>

            <Button size="small" color="danger" onClick={() => setShowAddExpense(true)} className="mb-4">➕ 添加费用</Button>

            {/* 添加费用表单 */}
            {showAddExpense && (
              <div className="bg-white rounded-lg p-3 mb-4 shadow-sm space-y-3">
                <div className="flex gap-2">
                  <Button size="small" onClick={() => setNewExpenseType('income')} color={newExpenseType === 'income' ? 'success' : 'default'}>收入</Button>
                  <Button size="small" onClick={() => setNewExpenseType('expense')} color={newExpenseType === 'expense' ? 'danger' : 'default'}>支出</Button>
                </div>
                <Input placeholder="金额" type="number" value={newExpenseAmount} onChange={setNewExpenseAmount} />
                <div className="text-xs text-gray-500">
                  分类: {newExpenseType === 'income' ? expenseCategories.income.join(', ') : expenseCategories.expense.join(', ')}
                </div>
                <Input placeholder="分类" value={newExpenseCategory} onChange={setNewExpenseCategory} />
                <Input placeholder="描述（可选）" value={newExpenseDesc} onChange={setNewExpenseDesc} />
                <div className="flex gap-2">
                  <Button size="small" onClick={() => setShowAddExpense(false)}>取消</Button>
                  <Button size="small" color="danger" onClick={handleAddExpense}>添加</Button>
                </div>
              </div>
            )}

            {/* 费用列表 */}
            <div className="space-y-2">
              {expenses.map(expense => (
                <div key={expense.id} className="bg-white rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <span className={`font-bold ${expense.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {expense.type === 'income' ? '+' : '-'}¥{parseFloat(expense.amount as any).toFixed(2)}
                    </span>
                    <span className="ml-2 text-gray-600">{expense.category}</span>
                    {expense.description && <div className="text-xs text-gray-400">{expense.description}</div>}
                  </div>
                  <button onClick={() => handleDeleteExpense(expense.id)} className="text-red-500 text-sm">删除</button>
                </div>
              ))}
              {expenses.length === 0 && <div className="text-center text-gray-400 py-8">暂无费用记录</div>}
            </div>
          </div>
        </Tabs.Tab>

        <Tabs.Tab title="备忘录" key="memo">
          <div className="p-4">
            <textarea
              className="w-full h-64 border rounded-lg p-3"
              placeholder="在此输入备忘录内容..."
              value={memoContent}
              onChange={(e) => setMemoContent(e.target.value)}
            />
            <Button color="danger" className="mt-3" onClick={handleSaveMemo} loading={savingMemo}>
              保存备忘录
            </Button>
          </div>
        </Tabs.Tab>

        <Tabs.Tab title="附件" key="attachments">
          <div className="p-4">
            <label className="block">
              <Button component="span" color="danger" className="w-full">📎 上传附件</Button>
              <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx" />
            </label>

            <div className="mt-4 space-y-2">
              {attachments.map(att => (
                <div key={att.id} className="bg-white rounded-lg p-3 flex items-center gap-3">
                  {att.fileType.startsWith('image/') ? (
                    <Image src={att.filePath} className="w-12 h-12 object-cover rounded" />
                  ) : (
                    <span className="text-2xl">📄</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm">{att.fileName}</div>
                    <div className="text-xs text-gray-400">{(att.fileSize / 1024).toFixed(1)} KB</div>
                  </div>
                  <button onClick={() => handleDeleteAttachment(att.id)} className="text-red-500 text-sm">删除</button>
                </div>
              ))}
              {attachments.length === 0 && <div className="text-center text-gray-400 py-8">暂无附件</div>}
            </div>
          </div>
        </Tabs.Tab>

        <Tabs.Tab title="节点操作" key="actions">
          <div className="p-4 space-y-4">
            <div className="bg-white rounded-lg p-4">
              <h3 className="font-medium mb-3">状态管理</h3>
              <div className="flex gap-2">
                <Button size="small" onClick={() => handleStatusChange('in_progress')}>开始</Button>
                <Button size="small" color="success" onClick={() => handleStatusChange('completed')}>完成</Button>
                <Button size="small" onClick={() => handleStatusChange('cancelled')}>取消</Button>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <h3 className="font-medium mb-3 text-red-600">危险操作</h3>
              <Button color="danger" onClick={handleDeleteNode}>删除此节点</Button>
            </div>
          </div>
        </Tabs.Tab>
      </Tabs>
    </div>
  )
}
