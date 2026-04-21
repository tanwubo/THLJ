import { Popup } from 'antd-mobile'
import { TimelineTemplate } from '../../services/api'

type Props = {
  visible: boolean
  templates: TimelineTemplate[]
  activeTemplateId: number | null
  loading: boolean
  submitting: boolean
  onSelect: (id: number) => void
  onClose: () => void
  onApply: () => void
}

export default function TimelineTemplatePicker({
  visible,
  templates,
  activeTemplateId,
  loading,
  submitting,
  onSelect,
  onClose,
  onApply,
}: Props) {
  const activeTemplate = templates.find((template) => template.id === activeTemplateId) ?? null

  return (
    <Popup visible={visible} onMaskClick={onClose} bodyStyle={{ borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
      <div className="timeline-inline-panel">
        <div className="timeline-inline-panel__header">
          <p className="section-label">Templates</p>
          <h3 className="section-title">选择一套初始时间线</h3>
          <p className="section-copy">从模板开始，或者继续保持空白逐个创建节点。</p>
        </div>

        {loading ? <p className="section-copy">模板加载中...</p> : null}

        {!loading ? (
          <div className="settings-stack">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                className={template.id === activeTemplateId ? 'brand-primary-button' : 'brand-secondary-button'}
                onClick={() => onSelect(template.id)}
              >
                {template.name}
              </button>
            ))}
          </div>
        ) : null}

        {activeTemplate ? (
          <div className="settings-stack">
            <p className="section-copy">{activeTemplate.description}</p>
            {activeTemplate.nodes?.map((node) => (
              <div key={node.id ?? `${activeTemplate.id}-${node.order}`} className="timeline-stat">
                <span>{node.name}</span>
                <strong>{node.description || '无预置说明'}</strong>
              </div>
            ))}
            <div className="timeline-form-actions">
              <button type="button" className="brand-secondary-button" onClick={onClose}>
                取消
              </button>
              <button type="button" className="brand-primary-button" onClick={onApply} disabled={submitting}>
                {submitting ? '应用中...' : '使用此模板'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </Popup>
  )
}
