import { Dialog, Popup } from 'antd-mobile'
import { TimelineNode } from '../../services/api'
import NodeEditorForm, { NodeEditorFormState, NodeEditorMode } from './NodeEditorForm'

type NodeEditorModalProps = {
  visible: boolean
  mode: NodeEditorMode
  isMobile: boolean
  title: string
  eyebrow: string
  description: string
  form: NodeEditorFormState
  statusOptions: TimelineNode['status'][]
  confirmText: string
  onClose: () => void
  onSubmit: () => void | Promise<void>
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onDeadlineChange: (value: string) => void
  onStatusChange: (value: TimelineNode['status']) => void
}

export default function NodeEditorModal({
  visible,
  mode,
  isMobile,
  title,
  eyebrow,
  description,
  form,
  statusOptions,
  confirmText,
  onClose,
  onSubmit,
  onNameChange,
  onDescriptionChange,
  onDeadlineChange,
  onStatusChange,
}: NodeEditorModalProps) {
  const content = (
    <div className="timeline-node-editor">
      <div className="timeline-node-editor__header">
        <h2 className="timeline-edit-drawer__title">{title}</h2>
        <p className="section-label">{eyebrow}</p>
        <p className="section-copy">{description}</p>
      </div>
      <div className="timeline-node-editor__body">
        <NodeEditorForm
          mode={mode}
          form={form}
          statusOptions={statusOptions}
          onNameChange={onNameChange}
          onDescriptionChange={onDescriptionChange}
          onDeadlineChange={onDeadlineChange}
          onStatusChange={onStatusChange}
        />
      </div>
      <div className="timeline-node-editor__actions">
        <button type="button" className="brand-secondary-button" onClick={onClose}>
          取消
        </button>
        <button type="button" className="brand-primary-button" onClick={() => void onSubmit()}>
          {confirmText}
        </button>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Popup visible={visible} onMaskClick={onClose} bodyStyle={{ borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
        <div className="timeline-edit-drawer" data-testid="mobile-node-editor-drawer">
          {content}
        </div>
      </Popup>
    )
  }

  return <Dialog visible={visible} content={content} closeOnMaskClick onClose={onClose} />
}
