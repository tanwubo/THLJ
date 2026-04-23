import { query } from '../../db'
import type { AiCommandContext, AiPage } from './types'

interface BuildAiCommandContextArgs {
  dataOwnerId: number
  page: AiPage
  currentNodeId: number | null
  today: string
}

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value)
}

export function buildAiCommandContext({ dataOwnerId, page, currentNodeId, today }: BuildAiCommandContextArgs): AiCommandContext {
  const nodeRows = query('SELECT id, name FROM timeline_nodes WHERE user_id = ? ORDER BY "order" ASC, id ASC', [dataOwnerId])
  const nodes = nodeRows.map(row => ({
    id: toNumber(row.id),
    name: String(row.name),
    todos: [] as AiCommandContext['nodes'][number]['todos'],
  }))

  if (nodes.length === 0) {
    return { today, page, currentNodeId, nodes: [] }
  }

  const nodeIds = nodes.map(node => node.id)
  const placeholders = nodeIds.map(() => '?').join(',')
  const todoRows = query(
    `SELECT id, node_id, content FROM todo_items WHERE node_id IN (${placeholders}) ORDER BY node_id ASC, created_at DESC`,
    nodeIds,
  )

  const todosByNodeId = new Map<number, AiCommandContext['nodes'][number]['todos']>()
  for (const node of nodes) {
    todosByNodeId.set(node.id, [])
  }

  for (const row of todoRows) {
    const nodeId = toNumber(row.node_id)
    const todos = todosByNodeId.get(nodeId)
    if (!todos) {
      continue
    }

    todos.push({
      id: toNumber(row.id),
      content: String(row.content),
    })
  }

  return {
    today,
    page,
    currentNodeId,
    nodes: nodes.map(node => ({
      id: node.id,
      name: node.name,
      todos: todosByNodeId.get(node.id) ?? [],
    })),
  }
}
