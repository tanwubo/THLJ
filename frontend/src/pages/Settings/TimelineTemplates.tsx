import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Toast } from 'antd-mobile'
import AppShell from '../../components/layout/AppShell'
import BrandHeader from '../../components/layout/BrandHeader'
import SurfaceCard from '../../components/ui/SurfaceCard'
import { TimelineTemplate, TimelineTemplatePayload, timelineTemplateAPI } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import TimelineTemplateEditor from './TimelineTemplateEditor'

const EMPTY_TEMPLATE: TimelineTemplatePayload = {
  name: '',
  description: '',
  isActive: true,
  nodes: [],
}

export default function TimelineTemplates() {
  const { user } = useAuthStore()
  const [templates, setTemplates] = useState<TimelineTemplate[]>([])
  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null)
  const [form, setForm] = useState<TimelineTemplatePayload>(EMPTY_TEMPLATE)
  const [saving, setSaving] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (!user?.isAdmin) {
      return
    }

    const loadTemplates = async () => {
      const response = await timelineTemplateAPI.listTemplates(true)
      const nextTemplates = response.data.templates || []
      setTemplates(nextTemplates)

      const firstTemplateId = nextTemplates[0]?.id ?? null
      setActiveTemplateId(firstTemplateId)

      if (firstTemplateId) {
        const detail = await timelineTemplateAPI.getTemplate(firstTemplateId)
        setForm({
          name: detail.data.name,
          description: detail.data.description || '',
          isActive: detail.data.isActive ?? true,
          nodes: (detail.data.nodes || []).map((node) => ({
            name: node.name,
            description: node.description || '',
          })),
        })
      }
    }

    loadTemplates().catch(() => {
      Toast.show('获取模板失败')
    })
  }, [user?.isAdmin])

  if (!user?.isAdmin) {
    return <Navigate to="/settings" replace />
  }

  const handleSelectTemplate = async (templateId: number) => {
    setIsCreating(false)
    setActiveTemplateId(templateId)
    const detail = await timelineTemplateAPI.getTemplate(templateId)
    setForm({
      name: detail.data.name,
      description: detail.data.description || '',
      isActive: detail.data.isActive ?? true,
      nodes: (detail.data.nodes || []).map((node) => ({
        name: node.name,
        description: node.description || '',
      })),
    })
  }

  const handleSave = async () => {
    if (!isCreating && !activeTemplateId) {
      return
    }

    setSaving(true)

    try {
      if (isCreating) {
        await timelineTemplateAPI.createTemplate(form)
      } else {
        await timelineTemplateAPI.updateTemplate(activeTemplateId as number, form)
      }
      Toast.show('模板已保存')
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = () => {
    setIsCreating(true)
    setActiveTemplateId(null)
    setForm({
      name: '',
      description: '',
      isActive: true,
      nodes: [{ name: '', description: '' }],
    })
  }

  const handleDelete = async () => {
    if (!activeTemplateId || isCreating) {
      return
    }

    await timelineTemplateAPI.deleteTemplate(activeTemplateId)
    Toast.show('模板已删除')
  }

  return (
    <AppShell
      withBottomNav
      header={<BrandHeader eyebrow="Admin" title="时间线模板管理" subtitle={user.username} />}
    >
      <div className="settings-page">
        <SurfaceCard className="settings-section">
          <p className="section-label">Templates</p>
          <h2 className="section-title">模板列表</h2>
          <div className="settings-stack">
            <button type="button" className="brand-secondary-button" onClick={handleCreate}>
              新建模板
            </button>
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                className={template.id === activeTemplateId ? 'brand-primary-button' : 'brand-secondary-button'}
                onClick={() => handleSelectTemplate(template.id)}
              >
                {template.name}
              </button>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard className="settings-section">
          <p className="section-label">Editor</p>
          <h2 className="section-title">模板编辑</h2>
          <TimelineTemplateEditor
            value={form}
            onChange={setForm}
            onSubmit={handleSave}
            submitting={saving}
            onDelete={handleDelete}
            canDelete={!isCreating && activeTemplateId !== null}
          />
        </SurfaceCard>
      </div>
    </AppShell>
  )
}
