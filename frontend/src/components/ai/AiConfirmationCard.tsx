import type { AiParseCommandResponse } from '../../services/api'

type AiConfirmationCardProps = {
  result: AiParseCommandResponse
  onSelectNode: (node: { id: number; name: string }) => void
  onSelectTodo: (todo: { id: number; content: string; nodeId: number; nodeName: string }) => void
  onConfirm: () => void
  confirming: boolean
}

const actionTitles = {
  create_node: '新增节点',
  create_todo: '新增待办',
  create_expense: '新增费用',
}

const fieldLabels: Record<string, string> = {
  name: '名称',
  description: '说明',
  deadline: '截止日期',
  budget: '预算',
  nodeName: '节点',
  content: '待办',
  todoName: '待办',
  type: '类型',
  amount: '金额',
  category: '分类',
}

export default function AiConfirmationCard({
  result,
  onSelectNode,
  onSelectTodo,
  onConfirm,
  confirming,
}: AiConfirmationCardProps) {
  if (result.status === 'unsupported' || !result.draft) {
    return <section className="ai-confirm-card ai-confirm-card--muted">{result.summary}</section>
  }

  const { draft } = result
  const fields = Object.entries(draft.fields).filter((entry) => entry[1] !== undefined && entry[1] !== null && entry[1] !== '')

  return (
    <section className="ai-confirm-card">
      <div className="ai-confirm-card__header">
        <span className="ai-confirm-card__eyebrow">AI 草稿</span>
        <h3>{actionTitles[draft.actionType]}</h3>
      </div>

      <p className="ai-confirm-card__summary">{result.summary}</p>

      {fields.length > 0 ? (
        <dl className="ai-confirm-card__fields">
          {fields.map(([key, value]) => (
            <div key={key} className="ai-confirm-card__field">
              <dt>{fieldLabels[key] ?? key}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {result.candidates.nodes?.length ? (
        <div className="ai-confirm-card__choices" aria-label="候选节点">
          {result.candidates.nodes.map((node) => (
            <button key={node.id} type="button" className="ai-confirm-card__choice" onClick={() => onSelectNode(node)}>
              选择 {node.name}
            </button>
          ))}
        </div>
      ) : null}

      {result.candidates.todos?.length ? (
        <div className="ai-confirm-card__choices" aria-label="候选待办">
          {result.candidates.todos.map((todo) => (
            <button key={todo.id} type="button" className="ai-confirm-card__choice" onClick={() => onSelectTodo(todo)}>
              选择 {todo.nodeName} / {todo.content}
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        className="brand-primary-button ai-confirm-card__confirm"
        onClick={onConfirm}
        disabled={result.status !== 'ready' || confirming}
      >
        {confirming ? '添加中...' : '确认添加'}
      </button>
    </section>
  )
}
