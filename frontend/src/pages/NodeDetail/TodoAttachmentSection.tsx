import { Button, Dialog, Image, Popup, Toast } from 'antd-mobile'
import { useRef, useState } from 'react'
import { attachmentAPI } from '../../services/api'
import type { WorkbenchTodo } from './types'

type TodoAttachmentSectionProps = {
  todo: WorkbenchTodo
  expanded: boolean
  onToggle: () => void
  onRefresh: () => Promise<unknown>
}

export function TodoAttachmentSection({ todo, expanded, onToggle, onRefresh }: TodoAttachmentSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [previewAttachment, setPreviewAttachment] = useState<WorkbenchTodo['attachments'][number] | null>(null)

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      await attachmentAPI.uploadAttachment(todo.id, file)
      Toast.show('上传成功')
      await onRefresh()
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '上传失败')
    } finally {
      event.target.value = ''
    }
  }

  const handleDelete = async (attachmentId: number) => {
    const confirmed = await Dialog.confirm({ content: '确定删除该附件？' }).then(() => true).catch(() => false)
    if (!confirmed) {
      return
    }

    try {
      await attachmentAPI.deleteAttachment(attachmentId)
      Toast.show('删除成功')
      await onRefresh()
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '删除失败')
    }
  }

  const handleAttachmentOpen = (attachment: WorkbenchTodo['attachments'][number]) => {
    if (attachment.fileType.startsWith('image/')) {
      setPreviewAttachment(attachment)
      return
    }

    const link = document.createElement('a')
    link.href = attachment.filePath
    link.download = attachment.fileName
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <>
      <section className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-gray-900">附件</div>
            <div className="mt-1 text-xs text-gray-500">{todo.attachments.length} 个文件</div>
          </div>
          <Button size="small" fill="none" onClick={onToggle}>
            {expanded ? '收起' : '展开'}
          </Button>
        </div>

        {expanded && (
          <div className="mt-3 space-y-3">
            <div>
              <Button size="small" onClick={() => fileInputRef.current?.click()}>
                上传该待办附件
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleUpload}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              />
            </div>
            {todo.attachments.length === 0 ? (
              <div className="rounded-xl bg-white px-3 py-4 text-sm text-gray-400">暂无附件</div>
            ) : (
              todo.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-3 rounded-xl bg-white px-3 py-3 shadow-sm"
                >
                  <button
                    type="button"
                    aria-label={`${attachment.fileType.startsWith('image/') ? '预览附件' : '下载附件'} ${attachment.fileName}`}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => handleAttachmentOpen(attachment)}
                  >
                    {attachment.fileType.startsWith('image/') ? (
                      <Image src={attachment.filePath} width={44} height={44} fit="cover" className="rounded-lg" />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-50 text-xl">📎</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-gray-800">{attachment.fileName}</div>
                      <div className="mt-1 text-xs text-gray-400">{(attachment.fileSize / 1024).toFixed(1)} KB</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleDelete(attachment.id)
                    }}
                    className="text-sm text-red-500"
                  >
                    删除
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      <Popup
        visible={previewAttachment !== null}
        onMaskClick={() => setPreviewAttachment(null)}
        bodyStyle={{ borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
      >
        {previewAttachment ? (
          <div className="space-y-3 p-4">
            <div className="text-sm font-semibold text-gray-900">{previewAttachment.fileName}</div>
            <img
              src={previewAttachment.filePath}
              alt={previewAttachment.fileName}
              className="max-h-[70vh] w-full rounded-2xl object-contain"
            />
          </div>
        ) : null}
      </Popup>
    </>
  )
}

export default TodoAttachmentSection
