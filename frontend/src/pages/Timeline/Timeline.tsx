import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, Input, Toast } from 'antd-mobile'
import AppShell from '../../components/layout/AppShell'
import BrandHeader from '../../components/layout/BrandHeader'
import StatusPill from '../../components/ui/StatusPill'
import SurfaceCard from '../../components/ui/SurfaceCard'
import { useAuthStore } from '../../store/authStore'
import { timelineAPI, TimelineNode } from '../../services/api'

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

  const handleEditNode = (node: TimelineNode, event: React.MouseEvent) => {
    event.stopPropagation()
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

  const handleDeleteNode = async (nodeId: number, event: React.MouseEvent) => {
    event.stopPropagation()
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

  const handleStatusChange = async (node: TimelineNode, newStatus: string, event: React.MouseEvent) => {
    event.stopPropagation()
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
            <button type="button" className="brand-primary-button" onClick={() => setShowCreate(true)}>
              创建节点
            </button>
          </div>
        </SurfaceCard>

        {showCreate ? (
          <SurfaceCard className="timeline-form-card">
            <h3 className="section-title">创建新节点</h3>
            <div className="timeline-form-grid">
              <label className="auth-form__field">
                <span>节点名称</span>
                <Input placeholder="例如：婚纱礼服确认" value={newNodeName} onChange={setNewNodeName} />
              </label>
              <label className="auth-form__field">
                <span>描述</span>
                <textarea
                  value={newNodeDesc}
                  onChange={(event) => setNewNodeDesc(event.target.value)}
                  placeholder="补充这个阶段的关键说明"
                  rows={3}
                  className="themed-textarea"
                />
              </label>
              <label className="auth-form__field">
                <span>截止日期</span>
                <Input type="date" value={newNodeDeadline} onChange={setNewNodeDeadline} />
              </label>
              <div className="timeline-form-actions">
                <button type="button" className="brand-secondary-button" onClick={resetCreateForm}>
                  取消
                </button>
                <button type="button" className="brand-primary-button" onClick={handleCreateNode}>
                  创建
                </button>
              </div>
            </div>
          </SurfaceCard>
        ) : null}

        {editingNode ? (
          <SurfaceCard className="timeline-form-card">
            <h3 className="section-title">编辑节点</h3>
            <div className="timeline-form-grid">
              <label className="auth-form__field">
                <span>节点名称</span>
                <Input
                  placeholder="节点名称"
                  value={editingNode.name}
                  onChange={(value) => setEditingNode({ ...editingNode, name: value })}
                />
              </label>
              <label className="auth-form__field">
                <span>描述</span>
                <textarea
                  value={editingNode.description || ''}
                  onChange={(event) => setEditingNode({ ...editingNode, description: event.target.value })}
                  placeholder="描述"
                  rows={3}
                  className="themed-textarea"
                />
              </label>
              <label className="auth-form__field">
                <span>截止日期</span>
                <Input
                  type="date"
                  value={editingNode.deadline || ''}
                  onChange={(value) => setEditingNode({ ...editingNode, deadline: value })}
                />
              </label>
              <div className="timeline-form-actions">
                <button type="button" className="brand-secondary-button" onClick={() => setEditingNode(null)}>
                  取消
                </button>
                <button type="button" className="brand-primary-button" onClick={handleSaveEdit}>
                  保存
                </button>
              </div>
            </div>
          </SurfaceCard>
        ) : null}

        {nodes.length === 0 ? (
          <SurfaceCard className="timeline-empty-state">
            <p className="timeline-empty-state__title">还没有任何节点</p>
            <p className="timeline-empty-state__copy">先建立第一个里程碑，把婚礼筹备拆成清晰可执行的阶段。</p>
            <button type="button" className="brand-primary-button" onClick={() => setShowCreate(true)}>
              创建第一个节点
            </button>
          </SurfaceCard>
        ) : (
          <div className="timeline-node-list">
            {nodes.map((node) => (
              <SurfaceCard key={node.id} className="timeline-node-card">
                <button type="button" className="timeline-node-card__button" onClick={() => handleNodeClick(node.id)}>
                  <div className="timeline-node-card__header">
                    <div>
                      <h3 className="timeline-node-card__title">{node.name}</h3>
                      {node.description ? <p className="timeline-node-card__description">{node.description}</p> : null}
                    </div>
                    <StatusPill status={node.status as 'pending' | 'in_progress' | 'completed' | 'cancelled'} />
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
                      <button type="button" className="brand-inline-button" onClick={(event) => handleEditNode(node, event)}>
                        编辑
                      </button>
                      <button type="button" className="brand-inline-button brand-inline-button--danger" onClick={(event) => handleDeleteNode(node.id, event)}>
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
                </button>
              </SurfaceCard>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
