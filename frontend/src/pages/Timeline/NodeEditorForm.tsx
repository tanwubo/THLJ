import { Input } from 'antd-mobile'
import { DateField } from '../../components/DateField'
import { statusLabelMap } from '../../components/ui/StatusPill'
import { TimelineNode } from '../../services/api'

export type NodeEditorMode = 'create' | 'edit'

export type NodeEditorFormState = {
  name: string
  description: string
  deadline: string
  status: TimelineNode['status']
}

type NodeEditorFormProps = {
  mode: NodeEditorMode
  form: NodeEditorFormState
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onDeadlineChange: (value: string) => void
  onStatusChange: (value: TimelineNode['status']) => void
  statusOptions: TimelineNode['status'][]
}

export default function NodeEditorForm({
  mode,
  form,
  onNameChange,
  onDescriptionChange,
  onDeadlineChange,
  onStatusChange,
  statusOptions,
}: NodeEditorFormProps) {
  return (
    <div className="timeline-node-dialog timeline-node-dialog--form-only">
      <div className="timeline-node-dialog__fields">
        <Input placeholder="节点名称 *" value={form.name} onChange={onNameChange} />
        <textarea
          value={form.description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="描述（可选）"
          rows={3}
          className="themed-textarea"
        />
        <DateField label="截止日期" value={form.deadline} onChange={onDeadlineChange} />
        {mode === 'edit' ? (
          <div className="timeline-node-dialog__status-group">
            <span className="timeline-node-dialog__status-label">节点状态</span>
            <div className="timeline-node-dialog__status-options">
              {statusOptions.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`timeline-node-dialog__status-option${form.status === status ? ' timeline-node-dialog__status-option--active' : ''}`}
                  onClick={() => onStatusChange(status)}
                >
                  {statusLabelMap[status]}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
