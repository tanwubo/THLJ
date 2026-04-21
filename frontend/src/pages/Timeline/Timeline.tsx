import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Dialog, Input, Toast } from 'antd-mobile'
import { DateField } from '../../components/DateField'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { timelineAPI, TimelineNode } from '../../services/api'
import { useAuthStore } from '../../store/authStore'

type NodeFormState = {
  name: string
  description: string
  deadline: string
}

const EMPTY_NODE_FORM: NodeFormState = {
  name: '',
  description: '',
  deadline: '',
}

export default function Timeline() {
  const navigate = useNavigate()
  const { user, partnerId, emitRealtimeEvent } = useAuthStore()
  const [nodes, setNodes] = useState<TimelineNode[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState<NodeFormState>(EMPTY_NODE_FORM)
  const [editingNodeId, setEditingNodeId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<NodeFormState>(EMPTY_NODE_FORM)

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

  useRealtimeRefresh(['node_update'], fetchTimeline, Boolean(partnerId))

  const handleNodeClick = (nodeId: number) => {
    navigate(`/node/${nodeId}`)
  }

  const openCreateModal = () => {
    setCreateForm(EMPTY_NODE_FORM)
    setIsCreateModalOpen(true)
  }

  const closeCreateModal = () => {
    setCreateForm(EMPTY_NODE_FORM)
    setIsCreateModalOpen(false)
  }

  const openEditModal = (node: TimelineNode, event: React.MouseEvent) => {
    event.stopPropagation()
    setEditingNodeId(node.id)
    setEditForm({
      name: node.name,
      description: node.description || '',
      deadline: node.deadline || '',
    })
  }

  const closeEditModal = () => {
    setEditingNodeId(null)
    setEditForm(EMPTY_NODE_FORM)
  }

  const handleCreateNode = async () => {
    if (!createForm.name.trim()) {
      Toast.show('请输入节点名称')
      return
    }

    try {
      await timelineAPI.createNode({
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        deadline: createForm.deadline || undefined,
      })
      emitRealtimeEvent('node_update', 'created')
      Toast.show('创建成功')
      closeCreateModal()
      fetchTimeline()
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '创建失败')
    }
  }

  const handleSaveEdit = async () => {
    const editingNode = nodes.find((node) => node.id === editingNodeId)
    if (!editingNode) return

    if (!editForm.name.trim()) {
      Toast.show('请输入节点名称')
      return
    }

    try {
      await timelineAPI.updateNode(editingNode.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
        deadline: editForm.deadline || undefined,
        status: editingNode.status,
      })
      emitRealtimeEvent('node_update', 'updated', { id: editingNode.id })
      Toast.show('保存成功')
      closeEditModal()
      fetchTimeline()
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '保存失败')
    }
  }

  const handleDeleteNode = async (nodeId: number, event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      await Dialog.confirm({
        content: '确定要删除这个节点吗？关联的待办、费用等数据也会被删除',
        confirmText: '删除',
      })
      await timelineAPI.deleteNode(nodeId)
      emitRealtimeEvent('node_update', 'deleted', { id: nodeId })
      Toast.show('删除成功')
      fetchTimeline()
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '删除失败')
    }
  }

  const handleStatusChange = async (node: TimelineNode, newStatus: string, event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      await timelineAPI.updateNode(node.id, { status: newStatus })
      emitRealtimeEvent('node_update', 'status_changed', { id: node.id, status: newStatus })
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
      case 'completed':
        return '✅ 已完成'
      case 'in_progress':
        return '🔄 进行中'
      case 'cancelled':
        return '❌ 已取消'
      default:
        return '⏳ 待处理'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700'
      case 'in_progress':
        return 'bg-blue-100 text-blue-700'
      case 'cancelled':
        return 'bg-gray-100 text-gray-500'
      default:
        return 'bg-yellow-100 text-yellow-700'
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
    <div className="timeline-shell bg-gray-50" data-testid="timeline-shell">
      <div className="timeline-shell__header bg-wedding-red text-white p-4" data-testid="timeline-header">
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

      <div className="timeline-shell__scroll" data-testid="timeline-scroll-region">
        <div className="p-4">
          {nodes.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500 mb-4">还没有任何节点</p>
              <Button onClick={openCreateModal} color="danger" size="large">
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
                        onClick={(event) => openEditModal(node, event)}
                        className="text-blue-500 text-sm"
                      >
                        编辑
                      </button>
                      <button
                        onClick={(event) => handleDeleteNode(node.id, event)}
                        className="text-red-500 text-sm"
                      >
                        删除
                      </button>
                    </div>
                  </div>

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

                  <div className="mt-3 flex justify-between items-center">
                    {node.deadline && (
                      <p className="text-xs text-gray-400">截止: {node.deadline}</p>
                    )}
                    <div className="flex gap-1 ml-auto">
                      {node.status === 'pending' && (
                        <Button
                          size="small"
                          onClick={(event) => handleStatusChange(node, 'in_progress', event)}
                        >
                          开始
                        </Button>
                      )}
                      {node.status === 'in_progress' && (
                        <Button
                          size="small"
                          color="success"
                          onClick={(event) => handleStatusChange(node, 'completed', event)}
                        >
                          完成
                        </Button>
                      )}
                      {(node.status === 'pending' || node.status === 'in_progress') && (
                        <Button
                          size="small"
                          onClick={(event) => handleStatusChange(node, 'cancelled', event)}
                        >
                          取消
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={openCreateModal}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-500 hover:border-wedding-red hover:text-wedding-red transition"
              >
                + 添加节点
              </button>
            </div>
          )}
        </div>
      </div>

      <Dialog
        visible={isCreateModalOpen}
        title="创建节点"
        content={
          <div className="space-y-3 pt-2">
            <Input
              placeholder="节点名称 *"
              value={createForm.name}
              onChange={(value) => setCreateForm((current) => ({ ...current, name: value }))}
            />
            <textarea
              value={createForm.description}
              onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="描述（可选）"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
            <DateField
              label="截止日期"
              value={createForm.deadline}
              onChange={(value) => setCreateForm((current) => ({ ...current, deadline: value }))}
            />
          </div>
        }
        actions={[
          [
            { key: 'cancel', text: '取消' },
            { key: 'confirm', text: '创建', bold: true },
          ],
        ]}
        closeOnAction={false}
        closeOnMaskClick
        onAction={async (action) => {
          if (action.key === 'cancel') {
            closeCreateModal()
            return
          }
          await handleCreateNode()
        }}
        onClose={closeCreateModal}
      />

      <Dialog
        visible={editingNodeId !== null}
        title="编辑节点"
        content={
          <div className="space-y-3 pt-2">
            <Input
              placeholder="节点名称 *"
              value={editForm.name}
              onChange={(value) => setEditForm((current) => ({ ...current, name: value }))}
            />
            <textarea
              value={editForm.description}
              onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="描述（可选）"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
            <DateField
              label="截止日期"
              value={editForm.deadline}
              onChange={(value) => setEditForm((current) => ({ ...current, deadline: value }))}
            />
          </div>
        }
        actions={[
          [
            { key: 'cancel', text: '取消' },
            { key: 'confirm', text: '保存', bold: true },
          ],
        ]}
        closeOnAction={false}
        closeOnMaskClick
        onAction={async (action) => {
          if (action.key === 'cancel') {
            closeEditModal()
            return
          }
          await handleSaveEdit()
        }}
        onClose={closeEditModal}
      />

      <div
        className="timeline-shell__nav bg-white border-t flex justify-around py-2"
        data-testid="timeline-bottom-nav"
      >
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
