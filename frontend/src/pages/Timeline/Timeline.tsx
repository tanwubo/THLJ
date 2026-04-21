import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, Input, Toast } from 'antd-mobile'
import AppShell from '../../components/layout/AppShell'
import BrandHeader from '../../components/layout/BrandHeader'
import StatusPill from '../../components/ui/StatusPill'
import SurfaceCard from '../../components/ui/SurfaceCard'
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

  const handleNodeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, nodeId: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleNodeClick(nodeId)
    }
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

  const summaryTitle = partnerId ? `${user?.username ?? ''} · 双人筹备中` : `${user?.username ?? ''} · 单人筹备`

  if (loading) {
    return <div className="app-loading-screen">加载中...</div>
  }

  return (
    <AppShell
      withBottomNav
      header={
        <BrandHeader
          eyebrow="Ceremony Planner"
          title="婚礼时间线"
          subtitle={summaryTitle}
          aside={
            <button type="button" className="brand-ghost-button" onClick={handleLogout}>
              退出
            </button>
          }
        />
      }
    >
      <div className="timeline-page">
        <SurfaceCard className="timeline-overview-card">
          <div>
            <p className="section-label">Overview</p>
            <h2 className="section-title">把每个筹备阶段安排得更稳妥</h2>
            <p className="section-copy">按节点推进进度、预算和协作事项，保持节奏清晰。</p>
          </div>
          <div className="timeline-overview-card__stats">
            <div className="timeline-stat">
              <span>节点总数</span>
              <strong>{nodes.length}</strong>
            </div>
            <button type="button" className="brand-primary-button" onClick={openCreateModal}>
              创建节点
            </button>
          </div>
        </SurfaceCard>

        {nodes.length === 0 ? (
          <SurfaceCard className="timeline-empty-state">
            <p className="timeline-empty-state__title">还没有任何节点</p>
            <p className="timeline-empty-state__copy">先建立第一个里程碑，把婚礼筹备拆成清晰可执行的阶段。</p>
            <button type="button" className="brand-primary-button" onClick={openCreateModal}>
              创建第一个节点
            </button>
          </SurfaceCard>
        ) : (
          <div className="timeline-node-list">
            {nodes.map((node) => (
              <SurfaceCard key={node.id} className="timeline-node-card">
                <div
                  className="timeline-node-card__button"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNodeClick(node.id)}
                  onKeyDown={(event) => handleNodeKeyDown(event, node.id)}
                >
                  <div className="timeline-node-card__header">
                    <div>
                      <h3 className="timeline-node-card__title">{node.name}</h3>
                      {node.description ? <p className="timeline-node-card__description">{node.description}</p> : null}
                    </div>
                    <StatusPill status={node.status} />
                  </div>

                  <div className="timeline-progress">
                    <div className="timeline-progress__meta">
                      <span>进度</span>
                      <span>{node.progress}%</span>
                    </div>
                    <div className="timeline-progress__track">
                      <div className="timeline-progress__value" style={{ width: `${node.progress}%` }} />
                    </div>
                  </div>

                  <div className="timeline-node-card__footer">
                    <div className="timeline-node-card__deadline">
                      {node.deadline ? `截止：${node.deadline}` : '未设置截止日期'}
                    </div>
                    <div className="timeline-node-card__actions">
                      <button type="button" className="brand-inline-button" onClick={(event) => openEditModal(node, event)}>
                        编辑
                      </button>
                      <button
                        type="button"
                        className="brand-inline-button brand-inline-button--danger"
                        onClick={(event) => handleDeleteNode(node.id, event)}
                      >
                        删除
                      </button>
                    </div>
                  </div>

                  <div className="timeline-node-card__status-actions">
                    {node.status === 'pending' ? (
                      <button type="button" className="brand-secondary-button" onClick={(event) => handleStatusChange(node, 'in_progress', event)}>
                        开始
                      </button>
                    ) : null}
                    {node.status === 'in_progress' ? (
                      <button type="button" className="brand-primary-button" onClick={(event) => handleStatusChange(node, 'completed', event)}>
                        完成
                      </button>
                    ) : null}
                    {(node.status === 'pending' || node.status === 'in_progress') ? (
                      <button type="button" className="brand-secondary-button" onClick={(event) => handleStatusChange(node, 'cancelled', event)}>
                        取消
                      </button>
                    ) : null}
                  </div>
                </div>
              </SurfaceCard>
            ))}

            <button type="button" onClick={openCreateModal} className="brand-secondary-button">
              添加节点
            </button>
          </div>
        )}
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
              className="themed-textarea"
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
              className="themed-textarea"
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
    </AppShell>
  )
}
