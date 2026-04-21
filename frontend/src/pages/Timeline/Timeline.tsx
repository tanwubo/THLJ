import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, Popup, Toast } from 'antd-mobile'
import AppShell from '../../components/layout/AppShell'
import ThemedCalendarPicker from '../../components/ThemedCalendarPicker'
import BrandHeader from '../../components/layout/BrandHeader'
import StatusPill, { statusLabelMap } from '../../components/ui/StatusPill'
import SurfaceCard from '../../components/ui/SurfaceCard'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { timelineAPI, TimelineNode, TimelineTemplate, timelineTemplateAPI } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import NodeEditorModal from './NodeEditorModal'
import TimelineTemplatePicker from './TimelineTemplatePicker'

type NodeFormState = {
  name: string
  description: string
  deadline: string
  status: TimelineNode['status']
}

const EMPTY_NODE_FORM: NodeFormState = {
  name: '',
  description: '',
  deadline: '',
  status: 'pending',
}

const STATUS_OPTIONS: TimelineNode['status'][] = ['pending', 'in_progress', 'completed', 'cancelled']

type InlineNameState = {
  nodeId: number
  value: string
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
  const [inlineNameState, setInlineNameState] = useState<InlineNameState | null>(null)
  const [statusMenuNodeId, setStatusMenuNodeId] = useState<number | null>(null)
  const [actionsMenuNodeId, setActionsMenuNodeId] = useState<number | null>(null)
  const [deadlinePickerNodeId, setDeadlinePickerNodeId] = useState<number | null>(null)
  const [isMobileDeadlinePicker, setIsMobileDeadlinePicker] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false)
  const [templates, setTemplates] = useState<TimelineTemplate[]>([])
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateSubmitting, setTemplateSubmitting] = useState(false)
  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null)

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

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileDeadlinePicker(event.matches)
    }

    setIsMobileDeadlinePicker(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  useRealtimeRefresh(['node_update'], fetchTimeline, Boolean(partnerId))

  useEffect(() => {
    if (deadlinePickerNodeId === null || isMobileDeadlinePicker) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-deadline-panel-root="true"]')) {
        return
      }
      setDeadlinePickerNodeId(null)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [deadlinePickerNodeId, isMobileDeadlinePicker])

  const buildUpdatePayload = (
    node: TimelineNode,
    overrides: Partial<Pick<TimelineNode, 'name' | 'description' | 'deadline' | 'status'>>,
  ) => {
    const name = (overrides.name ?? node.name).trim()
    const description = overrides.description ?? node.description ?? ''
    const deadline = overrides.deadline ?? node.deadline ?? ''
    const status = overrides.status ?? node.status

    return {
      name,
      description: description.trim() || undefined,
      deadline: deadline || undefined,
      status,
    }
  }

  const persistNodeUpdate = async (
    node: TimelineNode,
    overrides: Partial<Pick<TimelineNode, 'name' | 'description' | 'deadline' | 'status'>>,
    successMessage = '保存成功',
  ) => {
    const payload = buildUpdatePayload(node, overrides)

    if (!payload.name) {
      Toast.show('请输入节点名称')
      return false
    }

    const unchanged =
      payload.name === node.name &&
      (payload.description ?? '') === (node.description ?? '') &&
      (payload.deadline ?? '') === (node.deadline ?? '') &&
      payload.status === node.status

    if (unchanged) {
      return true
    }

    try {
      await timelineAPI.updateNode(node.id, payload)
      emitRealtimeEvent('node_update', 'updated', { id: node.id })
      Toast.show(successMessage)
      await fetchTimeline()
      return true
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '保存失败')
      return false
    }
  }

  const handleNodeClick = (nodeId: number) => {
    navigate(`/node/${nodeId}`)
  }

  const handleNodeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, nodeId: number) => {
    if (event.target !== event.currentTarget) {
      return
    }

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

  const openEditModal = (node: TimelineNode) => {
    setInlineNameState(null)
    closeInlinePanels()
    setEditingNodeId(node.id)
    setEditForm({
      name: node.name,
      description: node.description || '',
      deadline: node.deadline || '',
      status: node.status,
    })
    setActionsMenuNodeId(null)
  }

  const closeEditModal = () => {
    setEditingNodeId(null)
    setEditForm(EMPTY_NODE_FORM)
  }

  const closeInlinePanels = () => {
    setStatusMenuNodeId(null)
    setActionsMenuNodeId(null)
    setDeadlinePickerNodeId(null)
  }

  const startInlineNameEdit = (node: TimelineNode, event: React.MouseEvent) => {
    event.stopPropagation()
    closeInlinePanels()
    setInlineNameState({ nodeId: node.id, value: node.name })
  }

  const submitInlineNameEdit = async (node: TimelineNode) => {
    if (!inlineNameState || inlineNameState.nodeId !== node.id) {
      return
    }

    const nextName = inlineNameState.value.trim()
    if (!nextName) {
      Toast.show('请输入节点名称')
      return
    }

    const saved = await persistNodeUpdate(node, { name: nextName })
    if (saved) {
      setInlineNameState(null)
    }
  }

  const cancelInlineNameEdit = () => {
    setInlineNameState(null)
  }

  const handleInlineDeadlineChange = async (value: string) => {
    const activeNode = nodes.find((node) => node.id === deadlinePickerNodeId)
    if (!activeNode) {
      setDeadlinePickerNodeId(null)
      return
    }

    const saved = await persistNodeUpdate(activeNode, { deadline: value })
    if (saved) {
      setDeadlinePickerNodeId(null)
    }
  }

  const handleInlineDeadlineClear = async () => {
    const activeNode = nodes.find((node) => node.id === deadlinePickerNodeId)
    if (!activeNode) {
      setDeadlinePickerNodeId(null)
      return
    }

    const saved = await persistNodeUpdate(activeNode, { deadline: '' })
    if (saved) {
      setDeadlinePickerNodeId(null)
    }
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
      await fetchTimeline()
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '创建失败')
    }
  }

  const handleSaveEdit = async () => {
    const editingNode = nodes.find((node) => node.id === editingNodeId)
    if (!editingNode) return

    const saved = await persistNodeUpdate(editingNode, {
      name: editForm.name,
      description: editForm.description,
      deadline: editForm.deadline,
      status: editForm.status,
    })

    if (saved) {
      closeEditModal()
    }
  }

  const handleDeleteNode = async (nodeId: number) => {
    const confirmed = await Dialog.confirm({
        content: '确定要删除这个节点吗？关联的待办、费用等数据也会被删除',
        confirmText: '删除',
      })
      .then(() => true)
      .catch(() => false)

    if (!confirmed) {
      return
    }

    try {
      await timelineAPI.deleteNode(nodeId)
      emitRealtimeEvent('node_update', 'deleted', { id: nodeId })
      Toast.show('删除成功')
      setActionsMenuNodeId(null)
      await fetchTimeline()
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '删除失败')
    }
  }

  const handleStatusChange = async (node: TimelineNode, status: TimelineNode['status']) => {
    const saved = await persistNodeUpdate(node, { status }, '状态已更新')
    if (saved) {
      setStatusMenuNodeId(null)
    }
  }

  const handleLogout = () => {
    useAuthStore.getState().logout()
    navigate('/login')
  }

  const loadTemplateDetail = async (templateId: number) => {
    const response = await timelineTemplateAPI.getTemplate(templateId)
    setTemplates((current) =>
      current.map((template) =>
        template.id === templateId ? { ...template, ...response.data } : template,
      ),
    )
  }

  const openTemplatePicker = async () => {
    setTemplateLoading(true)
    setIsTemplatePickerOpen(true)

    try {
      const response = await timelineTemplateAPI.listTemplates()
      const nextTemplates = response.data.templates || []
      setTemplates(nextTemplates)

      const firstTemplateId = nextTemplates[0]?.id ?? null
      setActiveTemplateId(firstTemplateId)

      if (firstTemplateId) {
        await loadTemplateDetail(firstTemplateId)
      }
    } catch (error) {
      console.error('获取模板失败:', error)
      Toast.show('获取模板失败')
    } finally {
      setTemplateLoading(false)
    }
  }

  const handleSelectTemplate = async (templateId: number) => {
    setActiveTemplateId(templateId)
    await loadTemplateDetail(templateId)
  }

  const handleApplyTemplate = async () => {
    if (!activeTemplateId) {
      return
    }

    setTemplateSubmitting(true)

    try {
      await timelineTemplateAPI.applyTemplate(activeTemplateId)
      Toast.show('模板已应用')
      setIsTemplatePickerOpen(false)
      await fetchTimeline()
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '应用模板失败')
    } finally {
      setTemplateSubmitting(false)
    }
  }

  const summaryTitle = partnerId ? `${user?.username ?? ''} · 双人筹备中` : `${user?.username ?? ''} · 单人筹备`
  const deadlinePickerNode = nodes.find((node) => node.id === deadlinePickerNodeId) ?? null

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
            <p className="timeline-empty-state__copy">可以先从模板初始化，也可以继续空白创建自己的第一个里程碑。</p>
            <div className="timeline-form-actions">
              <button type="button" className="brand-primary-button" onClick={openTemplatePicker}>
                选择模板
              </button>
              <button type="button" className="brand-secondary-button" onClick={openCreateModal}>
                创建第一个节点
              </button>
            </div>
          </SurfaceCard>
        ) : (
          <div className="timeline-node-list">
            {nodes.map((node) => {
              const isEditingName = inlineNameState?.nodeId === node.id
              const isStatusMenuOpen = statusMenuNodeId === node.id
              const isActionsMenuOpen = actionsMenuNodeId === node.id

              return (
                <SurfaceCard key={node.id} className="timeline-node-card">
                  <div
                    className="timeline-node-card__shell"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleNodeClick(node.id)}
                    onKeyDown={(event) => handleNodeKeyDown(event, node.id)}
                  >
                    <div className="timeline-node-card__header">
                      <div className="timeline-node-card__title-block">
                        {isEditingName ? (
                          <input
                            aria-label="编辑节点名称"
                            className="timeline-node-card__title-input timeline-inline-input"
                            value={inlineNameState.value}
                            autoFocus
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              setInlineNameState((current) =>
                                current && current.nodeId === node.id ? { ...current, value: event.target.value } : current,
                              )
                            }
                            onBlur={() => submitInlineNameEdit(node)}
                            onKeyDown={(event) => {
                              event.stopPropagation()
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                event.currentTarget.blur()
                              }
                              if (event.key === 'Escape') {
                                event.preventDefault()
                                cancelInlineNameEdit()
                              }
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            aria-label="编辑节点名称"
                            className="timeline-node-card__title-button timeline-interactive-zone"
                            onClick={(event) => startInlineNameEdit(node, event)}
                          >
                            <span className="timeline-node-card__title">{node.name}</span>
                          </button>
                        )}
                        {node.description ? (
                          <p className="timeline-node-card__description" title={node.description}>
                            {node.description}
                          </p>
                        ) : null}
                      </div>

                      <div className="timeline-node-card__header-actions">
                        <div className="timeline-node-card__menu-anchor">
                          <button
                            type="button"
                            aria-label="编辑节点状态"
                            className={`timeline-node-card__status-trigger timeline-interactive-zone${isStatusMenuOpen ? ' timeline-interactive-zone--active' : ''}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              setActionsMenuNodeId(null)
                              setStatusMenuNodeId((current) => (current === node.id ? null : node.id))
                            }}
                          >
                            <StatusPill status={node.status} />
                          </button>

                          {isStatusMenuOpen ? (
                            <div className="timeline-floating-menu timeline-floating-menu--status" onClick={(event) => event.stopPropagation()}>
                              {STATUS_OPTIONS.map((status) => (
                                <button
                                  key={status}
                                  type="button"
                                  className={`timeline-floating-menu__item${status === node.status ? ' timeline-floating-menu__item--active' : ''}`}
                                  onClick={() => handleStatusChange(node, status)}
                                >
                                  {statusLabelMap[status]}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="timeline-node-card__menu-anchor">
                          <button
                            type="button"
                            aria-label="更多操作"
                            className={`timeline-node-card__more-button timeline-interactive-zone${isActionsMenuOpen ? ' timeline-interactive-zone--active' : ''}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              setStatusMenuNodeId(null)
                              setActionsMenuNodeId((current) => (current === node.id ? null : node.id))
                            }}
                          >
                            <span className="timeline-node-card__more-dots" aria-hidden="true">
                              <span />
                              <span />
                              <span />
                            </span>
                          </button>

                          {isActionsMenuOpen ? (
                            <div className="timeline-floating-menu" role="menu" onClick={(event) => event.stopPropagation()}>
                              <button type="button" className="timeline-floating-menu__item" onClick={() => openEditModal(node)}>
                                完整编辑
                              </button>
                              <button
                                type="button"
                                className="timeline-floating-menu__item timeline-floating-menu__item--danger"
                                onClick={() => handleDeleteNode(node.id)}
                              >
                                删除节点
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
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
                      <div className="timeline-node-card__deadline-anchor" data-deadline-panel-root="true">
                        <button
                          type="button"
                          aria-label="编辑节点时间"
                          className="timeline-node-card__deadline timeline-interactive-zone"
                          onClick={(event) => {
                            event.stopPropagation()
                            setStatusMenuNodeId(null)
                            setActionsMenuNodeId(null)
                            setDeadlinePickerNodeId((current) => (current === node.id ? null : node.id))
                          }}
                        >
                          {node.deadline ? `截止：${node.deadline}` : '未设置截止日期'}
                        </button>

                        {deadlinePickerNodeId === node.id && !isMobileDeadlinePicker ? (
                          <div
                            className="timeline-inline-panel timeline-inline-panel--desktop"
                            data-testid="desktop-deadline-panel"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="timeline-inline-panel__header">
                              <p className="section-label">Deadline</p>
                              <h3 className="section-title">调整节点时间</h3>
                              <p className="section-copy">选择日期后立即保存，点击卡片外部关闭。</p>
                            </div>
                            <ThemedCalendarPicker
                              value={node.deadline || ''}
                              onSelect={handleInlineDeadlineChange}
                              onClear={handleInlineDeadlineClear}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </SurfaceCard>
              )
            })}

            <button type="button" onClick={openCreateModal} className="brand-secondary-button">
              添加节点
            </button>
          </div>
        )}
      </div>

      <Popup
        visible={deadlinePickerNode !== null && isMobileDeadlinePicker}
        onMaskClick={() => setDeadlinePickerNodeId(null)}
        bodyStyle={{ borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
      >
        <div className="timeline-inline-panel">
          <div className="timeline-inline-panel__header">
            <p className="section-label">Deadline</p>
            <h3 className="section-title">调整节点时间</h3>
            <p className="section-copy">选择日期后立即保存，点击遮罩可关闭。</p>
          </div>
          <ThemedCalendarPicker
            value={deadlinePickerNode?.deadline || ''}
            onSelect={handleInlineDeadlineChange}
            onClear={handleInlineDeadlineClear}
          />
        </div>
      </Popup>

      <NodeEditorModal
        visible={isCreateModalOpen}
        mode="create"
        isMobile={isMobileDeadlinePicker}
        title="创建节点"
        eyebrow="New Node"
        description="先定义名称、说明与时间，让时间线结构保持清晰。"
        form={createForm}
        statusOptions={STATUS_OPTIONS}
        onNameChange={(value) => setCreateForm((current) => ({ ...current, name: value }))}
        onDescriptionChange={(value) => setCreateForm((current) => ({ ...current, description: value }))}
        onDeadlineChange={(value) => setCreateForm((current) => ({ ...current, deadline: value }))}
        onStatusChange={(value) => setCreateForm((current) => ({ ...current, status: value }))}
        confirmText="创建"
        onClose={closeCreateModal}
        onSubmit={handleCreateNode}
      />

      <NodeEditorModal
        visible={editingNodeId !== null}
        mode="edit"
        isMobile={isMobileDeadlinePicker}
        title="编辑节点"
        eyebrow="Complete Edit"
        description="在一个面板内调整节点名称、描述、状态与截止日期。"
        form={editForm}
        statusOptions={STATUS_OPTIONS}
        onNameChange={(value) => setEditForm((current) => ({ ...current, name: value }))}
        onDescriptionChange={(value) => setEditForm((current) => ({ ...current, description: value }))}
        onDeadlineChange={(value) => setEditForm((current) => ({ ...current, deadline: value }))}
        onStatusChange={(value) => setEditForm((current) => ({ ...current, status: value }))}
        confirmText="保存"
        onClose={closeEditModal}
        onSubmit={handleSaveEdit}
      />

      <TimelineTemplatePicker
        visible={isTemplatePickerOpen}
        templates={templates}
        activeTemplateId={activeTemplateId}
        loading={templateLoading}
        submitting={templateSubmitting}
        onSelect={handleSelectTemplate}
        onClose={() => setIsTemplatePickerOpen(false)}
        onApply={handleApplyTemplate}
      />
    </AppShell>
  )
}
