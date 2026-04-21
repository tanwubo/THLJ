import { Button, Input, Popup } from 'antd-mobile'
import { useEffect, useState } from 'react'
import DateField from '../../components/DateField'
import type { WorkbenchTodo } from './types'

type TodoModalProps = {
  visible: boolean
  initialTodo?: WorkbenchTodo | null
  onClose: () => void
  onSubmit: (values: { content: string; deadline?: string }) => Promise<void>
}

export function TodoModal({ visible, initialTodo, onClose, onSubmit }: TodoModalProps) {
  const [content, setContent] = useState('')
  const [deadline, setDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!visible) {
      return
    }

    setContent(initialTodo?.content ?? '')
    setDeadline(initialTodo?.deadline ?? '')
  }, [initialTodo, visible])

  const handleSubmit = async () => {
    if (!content.trim()) {
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({
        content: content.trim(),
        deadline: deadline || undefined,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Popup visible={visible} onMaskClick={onClose} bodyStyle={{ borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
      <div className="space-y-4 p-4">
        <div className="text-lg font-semibold text-gray-900">
          {initialTodo ? '编辑待办' : '添加待办'}
        </div>
        <Input
          placeholder="待办内容"
          value={content}
          onChange={setContent}
          clearable
        />
        <DateField
          label="截止日期"
          value={deadline}
          onChange={setDeadline}
        />
        <div className="flex gap-3 pt-2">
          <Button block onClick={onClose}>
            取消
          </Button>
          <Button block color="danger" loading={submitting} onClick={handleSubmit}>
            {initialTodo ? '保存' : '添加'}
          </Button>
        </div>
      </div>
    </Popup>
  )
}

export default TodoModal
