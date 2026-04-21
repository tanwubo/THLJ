import { TimelineTemplatePayload } from '../../services/api'

type EditableTemplateNode = {
  id?: number
  name: string
  description: string
}

type Props = {
  value: TimelineTemplatePayload
  onChange: (next: TimelineTemplatePayload) => void
  onSubmit: () => void
  submitting: boolean
  onDelete?: () => void
  canDelete?: boolean
}

export default function TimelineTemplateEditor({ value, onChange, onSubmit, submitting, onDelete, canDelete = false }: Props) {
  const updateNode = (index: number, patch: Partial<EditableTemplateNode>) => {
    onChange({
      ...value,
      nodes: value.nodes.map((node, nodeIndex) => (nodeIndex === index ? { ...node, ...patch } : node)),
    })
  }

  return (
    <div className="settings-stack">
      <label className="auth-form__field">
        <span>模板名称</span>
        <input
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          placeholder="模板名称"
        />
      </label>

      <label className="auth-form__field">
        <span>模板说明</span>
        <textarea
          value={value.description || ''}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
          placeholder="模板说明"
        />
      </label>

      <label className="auth-form__field">
        <span>模板状态</span>
        <input
          type="checkbox"
          checked={value.isActive}
          onChange={(event) => onChange({ ...value, isActive: event.target.checked })}
        />
      </label>

      {value.nodes.map((node, index) => (
        <div key={`${index}-${node.name}`} className="settings-stack">
          <label className="auth-form__field">
            <span>节点名称</span>
            <input
              value={node.name}
              onChange={(event) => updateNode(index, { name: event.target.value })}
              placeholder="节点名称"
            />
          </label>
          <label className="auth-form__field">
            <span>节点说明</span>
            <textarea
              value={node.description || ''}
              onChange={(event) => updateNode(index, { description: event.target.value })}
              placeholder="节点说明"
            />
          </label>
        </div>
      ))}

      <div className="timeline-form-actions">
        {canDelete ? (
          <button type="button" className="brand-secondary-button" onClick={onDelete}>
            删除模板
          </button>
        ) : null}
        <button type="button" className="brand-primary-button" onClick={onSubmit} disabled={submitting}>
          {submitting ? '保存中...' : '保存模板'}
        </button>
      </div>
    </div>
  )
}
