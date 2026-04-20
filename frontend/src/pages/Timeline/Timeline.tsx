import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { timelineAPI, TimelineNode } from '../../services/api'
import { Button, Toast, Dialog, Input } from 'antd-mobile'

export default function Timeline() {
  const navigate = useNavigate()
  const { user, partnerId } = useAuthStore()
  const [nodes, setNodes] = useState<TimelineNode[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingNode, setEditingNode] = useState<TimelineNode | null>(null)
  const [newNodeName, setNewNodeName] = useState('')
  const [newNodeDesc, setNewNodeDesc] = useState('')
  const [newNodeDeadline, setNewNodeDeadline] = useState('')

  const fetchTimeline = async () => {
    try {
      const response = await timelineAPI.getTimeline()
      setNodes(response.data.nodes || [])
    } catch (error) {
      console.error('获取时间线失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTimeline()
  }, [])

  const handleNodeClick = (nodeId: number) => {
    navigate(`/node/${nodeId}`)
  }

  const resetCreateForm = () => {
    setNewNodeName('')
    setNewNodeDesc('')
    setNewNodeDeadline('')
    setShowCreate(false)
  }

  const handleCreateNode = async () => {
    if (!newNodeName.trim()) {
      Toast.show('请输入节点名称')
      return
    }
    try {
      await timelineAPI.createNode({
        name: newNodeName.trim(),
        description: newNodeDesc.trim() || undefined,
        deadline: newNodeDeadline || undefined,
      })
      Toast.show('创建成功')
      resetCreateForm()
      fetchTimeline()
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '创建失败')
    }
  }

  const handleEditNode = (node: TimelineNode, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingNode({ ...node })
  }

  const handleSaveEdit = async () => {
    if (!editingNode) return
    try {
      await timelineAPI.updateNode(editingNode.id, {
        name: editingNode.name,
        description: editingNode.description,
        deadline: editingNode.deadline,
        status: editingNode.status,
      })
      Toast.show('保存成功')
      setEditingNode(null)
      fetchTimeline()
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '保存失败')
    }
  }

  const handleDeleteNode = async (nodeId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await Dialog.confirm({
        content: '确定要删除这个节点吗？关联的待办、费用等数据也会被删除',
        confirmText: '删除',
      })
      await timelineAPI.deleteNode(nodeId)
      Toast.show('删除成功')
      fetchTimeline()
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '删除失败')
    }
  }

  const handleStatusChange = async (node: TimelineNode, newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await timelineAPI.updateNode(node.id, { status: newStatus })
      fetchTimeline()
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '状态更新失败')
    }
  }

  const handleLogout = () => {
    useAuthStore.getState().logout()
    navigate('/login')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return '✅ 已完成'
      case 'in_progress': return '🔄 进行中'
      case 'cancelled': return '❌ 已取消'
      default: return '⏳ 待处理'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700'
      case 'in_progress': return 'bg-blue-100 text-blue-700'
      case 'cancelled': return 'bg-gray-100 text-gray-500'
      default: return 'bg-yellow-100 text-yellow-700'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* 头部 */}
      <div className="bg-wedding-red text-white p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">💒 婚嫁管家</h1>
          <button onClick={handleLogout} className="text-sm bg-white/20 px-3 py-1 rounded">
            退出
          </button>
        </div>
        <p className="text-sm mt-1">
          {user?.username} {partnerId && '💑'}
        </p>
      </div>

      {/* 时间线内容 */}
      <div className="p-4">
        {/* 创建表单 */}
        {showCreate && (
          <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
            <h3 className="font-medium mb-3">创建新节点</h3>
            <div className="space-y-3">
              <Input
                placeholder="节点名称 *"
                value={newNodeName}
                onChange={setNewNodeName}
              />
              <textarea
                value={newNodeDesc}
                onChange={(e) => setNewNodeDesc(e.target.value)}
                placeholder="描述（可选）"
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
              <Input
                placeholder="截止日期（可选）"
                type="date"
                value={newNodeDeadline}
                onChange={setNewNodeDeadline}
              />
              <div className="flex gap-2">
                <Button size="small" onClick={resetCreateForm}>取消</Button>
                <Button color="danger" size="small" onClick={handleCreateNode}>创建</Button>
              </div>
            </div>
          </div>
        )}

        {/* 编辑表单 */}
        {editingNode && (
          <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
            <h3 className="font-medium mb-3">编辑节点</h3>
            <div className="space-y-3">
              <Input
                placeholder="节点名称"
                value={editingNode.name}
                onChange={(v) => setEditingNode({ ...editingNode, name: v })}
              />
              <textarea
                value={editingNode.description || ''}
                onChange={(e) => setEditingNode({ ...editingNode, description: e.target.value })}
                placeholder="描述"
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
              <Input
                placeholder="截止日期"
                type="date"
                value={editingNode.deadline || ''}
                onChange={(v) => setEditingNode({ ...editingNode, deadline: v })}
              />
              <div className="flex gap-2">
                <Button size="small" onClick={() => setEditingNode(null)}>取消</Button>
                <Button color="danger" size="small" onClick={handleSaveEdit}>保存</Button>
              </div>
            </div>
          </div>
        )}

        {/* 节点列表 */}
        {nodes.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4">还没有任何节点</p>
            <Button onClick={() => setShowCreate(true)} color="danger" size="large">
              创建第一个节点
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {nodes.map((node) => (
              <div
                key={node.id}
                onClick={() => handleNodeClick(node.id)}
                className="bg-white rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-md transition"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{node.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(node.status)}`}>
                        {getStatusBadge(node.status)}
                      </span>
                    </div>
                    {node.description && (
                      <p className="text-sm text-gray-500 mt-1">{node.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => handleEditNode(node, e)}
                      className="text-blue-500 text-sm"
                    >
                      编辑
                    </button>
                    <button
                      onClick={(e) => handleDeleteNode(node.id, e)}
                      className="text-red-500 text-sm"
                    >
                      删除
                    </button>
                  </div>
                </div>

                {/* 进度条 */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>进度</span>
                    <span>{node.progress}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div
                      className="h-full bg-wedding-red rounded-full transition-all"
                      style={{ width: `${node.progress}%` }}
                    />
                  </div>
                </div>

                {/* 截止日期和状态操作 */}
                <div className="mt-3 flex justify-between items-center">
                  {node.deadline && (
                    <p className="text-xs text-gray-400">截止: {node.deadline}</p>
                  )}
                  <div className="flex gap-1 ml-auto">
                    {node.status === 'pending' && (
                      <Button
                        size="small"
                        onClick={(e) => handleStatusChange(node, 'in_progress', e)}
                      >
                        开始
                      </Button>
                    )}
                    {node.status === 'in_progress' && (
                      <Button
                        size="small"
                        color="success"
                        onClick={(e) => handleStatusChange(node, 'completed', e)}
                      >
                        完成
                      </Button>
                    )}
                    {(node.status === 'pending' || node.status === 'in_progress') && (
                      <Button
                        size="small"
                        onClick={(e) => handleStatusChange(node, 'cancelled', e)}
                      >
                        取消
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* 添加新节点按钮 */}
            {!showCreate && !editingNode && (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-500 hover:border-wedding-red hover:text-wedding-red transition"
              >
                + 添加节点
              </button>
            )}
          </div>
        )}
      </div>

      {/* 底部导航 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2">
        <button className="flex flex-col items-center text-wedding-red">
          <span className="text-xl">📋</span>
          <span className="text-xs">时间线</span>
        </button>
        <button onClick={() => navigate('/statistics')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📊</span>
          <span className="text-xs">统计</span>
        </button>
        <button onClick={() => navigate('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">设置</span>
        </button>
      </div>
    </div>
  )
}
