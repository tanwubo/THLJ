import { useMemo, useState } from 'react'
import { Popup } from 'antd-mobile'
import { useLocation } from 'react-router-dom'
import { aiAPI, expenseAPI, timelineAPI, todoAPI } from '../../services/api'
import type { AiPage, AiParseCommandResponse } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { confirmAiDraft } from './aiDraftActions'
import AiConfirmationCard from './AiConfirmationCard'

function getPageContext(pathname: string): { page: AiPage; currentNodeId: number | null } {
  if (pathname === '/') {
    return { page: 'timeline', currentNodeId: null }
  }

  const nodeMatch = pathname.match(/^\/node\/(\d+)$/)
  if (nodeMatch) {
    const currentNodeId = Number(nodeMatch[1])
    return { page: 'node-detail', currentNodeId: currentNodeId > 0 ? currentNodeId : null }
  }

  if (pathname === '/statistics') {
    return { page: 'statistics', currentNodeId: null }
  }

  if (pathname === '/settings' || pathname.startsWith('/settings/')) {
    return { page: 'settings', currentNodeId: null }
  }

  return { page: 'unknown', currentNodeId: null }
}

function getErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.error || fallback
}

export default function AIAssistantFloatingEntry() {
  const location = useLocation()
  const { emitRealtimeEvent } = useAuthStore()
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<AiParseCommandResponse | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [parsing, setParsing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const pageContext = useMemo(() => getPageContext(location.pathname), [location.pathname])

  const handleParse = async () => {
    const trimmed = message.trim()
    if (!trimmed || parsing) return

    setParsing(true)
    setError('')
    setSuccess('')
    try {
      const response = await aiAPI.parseCommand({
        message: trimmed,
        page: pageContext.page,
        currentNodeId: pageContext.currentNodeId,
      })
      setResult(response.data)
    } catch (parseError: any) {
      setError(getErrorMessage(parseError, 'AI 解析失败，请稍后再试'))
    } finally {
      setParsing(false)
    }
  }

  const handleSelectNode = (node: { id: number; name: string }) => {
    setResult((current) => {
      if (!current?.draft) return current
      return {
        ...current,
        status: 'ready',
        missingFields: [],
        draft: {
          ...current.draft,
          fields: {
            ...current.draft.fields,
            nodeId: node.id,
            nodeName: node.name,
          },
        },
      }
    })
  }

  const handleSelectTodo = (todo: { id: number; content: string; nodeId: number; nodeName: string }) => {
    setResult((current) => {
      if (!current?.draft) return current
      return {
        ...current,
        status: 'ready',
        missingFields: [],
        draft: {
          ...current.draft,
          fields: {
            ...current.draft.fields,
            todoId: todo.id,
            todoName: todo.content,
            nodeId: todo.nodeId,
            nodeName: todo.nodeName,
          },
        },
      }
    })
  }

  const handleConfirm = async () => {
    if (!result || confirming) return

    setConfirming(true)
    setError('')
    setSuccess('')
    try {
      await confirmAiDraft({
        result,
        timelineAPI,
        todoAPI,
        expenseAPI,
        emitRealtimeEvent,
      })
      setResult(null)
      setMessage('')
      setSuccess('创建成功')
    } catch (confirmError: any) {
      setError(getErrorMessage(confirmError, confirmError?.message || '创建失败，请稍后再试'))
    } finally {
      setConfirming(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="ai-floating-entry"
        aria-label="AI 对话入口，一句话添加节点待办费用"
        onClick={() => setVisible(true)}
      >
        <span className="ai-floating-entry__mark">AI</span>
        <span className="ai-floating-entry__copy">一句话</span>
      </button>

      <Popup
        visible={visible}
        onMaskClick={() => setVisible(false)}
        bodyClassName="ai-assistant-popup"
        bodyStyle={{ borderTopLeftRadius: 30, borderTopRightRadius: 30 }}
      >
        <div className="ai-assistant-drawer">
          <div className="ai-assistant-drawer__handle" aria-hidden="true" />
          <header className="ai-assistant-drawer__header">
            <div>
              <p className="section-label">AI Assistant</p>
              <h2>一句话添加节点/待办/费用</h2>
            </div>
            <button type="button" className="brand-inline-button" onClick={() => setVisible(false)}>
              关闭
            </button>
          </header>
          <p className="ai-assistant-drawer__copy">AI 会先生成草稿，所有节点、待办和费用都会在你确认后再创建。</p>

          <div className="ai-assistant-drawer__composer">
            <textarea
              className="themed-textarea ai-assistant-drawer__input"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="例如：增加一个10月1日拍婚纱照的节点"
            />
            <button type="button" className="brand-primary-button" onClick={() => void handleParse()} disabled={parsing || !message.trim()}>
              {parsing ? '解析中...' : '解析'}
            </button>
          </div>

          {error ? <p className="ai-assistant-drawer__error">{error}</p> : null}
          {success ? <p className="ai-assistant-drawer__success">{success}</p> : null}

          {result ? (
            <AiConfirmationCard
              result={result}
              onSelectNode={handleSelectNode}
              onSelectTodo={handleSelectTodo}
              onConfirm={() => void handleConfirm()}
              confirming={confirming}
            />
          ) : null}
        </div>
      </Popup>
    </>
  )
}
