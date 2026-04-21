import { query, run, runInTransaction } from '../db'

export interface PartnershipState {
  id: number
  username: string
  partnerId: number | null
  dataOwnerId: number
}

type RawUserRow = {
  id: number
  username: string
  partner_id: number | null
  data_owner_id: number | null
}

function getUsersByIds(ids: number[]): RawUserRow[] {
  if (ids.length === 0) {
    return []
  }

  return query(
    `SELECT id, username, partner_id, data_owner_id
     FROM users
     WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids,
  ) as RawUserRow[]
}

export function getUserPartnershipState(userId: number): PartnershipState | null {
  const users = query(
    'SELECT id, username, partner_id, data_owner_id FROM users WHERE id = ?',
    [userId],
  ) as RawUserRow[]

  if (users.length === 0) {
    return null
  }

  const user = users[0]
  return {
    id: user.id,
    username: user.username,
    partnerId: user.partner_id ?? null,
    dataOwnerId: user.data_owner_id ?? user.id,
  }
}

export function requireUserPartnershipState(userId: number): PartnershipState {
  const state = getUserPartnershipState(userId)
  if (!state) {
    throw new Error(`User ${userId} not found`)
  }
  return state
}

export async function replaceUserDataFromOwner(sourceOwnerId: number, targetUserId: number) {
  if (sourceOwnerId === targetUserId) {
    return
  }

  const targetNodeIds = (query(
    'SELECT id FROM timeline_nodes WHERE user_id = ?',
    [targetUserId],
  ) as Array<{ id: number }>).map((node) => node.id)

  const targetTodoIds = targetNodeIds.length > 0
    ? (query(
        `SELECT id FROM todo_items WHERE node_id IN (${targetNodeIds.map(() => '?').join(',')})`,
        targetNodeIds,
      ) as Array<{ id: number }>).map((todo) => todo.id)
    : []

  const deleteOperations: Array<{ sql: string; params?: any[] }> = []

  if (targetTodoIds.length > 0) {
    deleteOperations.push(
      {
        sql: `DELETE FROM attachments WHERE todo_id IN (${targetTodoIds.map(() => '?').join(',')})`,
        params: targetTodoIds,
      },
      {
        sql: `DELETE FROM expense_records WHERE todo_id IN (${targetTodoIds.map(() => '?').join(',')})`,
        params: targetTodoIds,
      },
    )
  }

  if (targetNodeIds.length > 0) {
    deleteOperations.push(
      {
        sql: `DELETE FROM attachments WHERE node_id IN (${targetNodeIds.map(() => '?').join(',')})`,
        params: targetNodeIds,
      },
      {
        sql: `DELETE FROM expense_records WHERE node_id IN (${targetNodeIds.map(() => '?').join(',')})`,
        params: targetNodeIds,
      },
      {
        sql: `DELETE FROM memos WHERE node_id IN (${targetNodeIds.map(() => '?').join(',')})`,
        params: targetNodeIds,
      },
      {
        sql: `DELETE FROM todo_items WHERE node_id IN (${targetNodeIds.map(() => '?').join(',')})`,
        params: targetNodeIds,
      },
      {
        sql: 'DELETE FROM timeline_nodes WHERE user_id = ?',
        params: [targetUserId],
      },
    )
  }

  if (deleteOperations.length > 0) {
    await runInTransaction(deleteOperations)
  }

  const sourceNodes = query(
    'SELECT * FROM timeline_nodes WHERE user_id = ? ORDER BY "order" ASC',
    [sourceOwnerId],
  ) as any[]

  if (sourceNodes.length === 0) {
    return
  }

  const sourceNodeIds = sourceNodes.map((node) => node.id)
  const sourceTodos = query(
    `SELECT * FROM todo_items WHERE node_id IN (${sourceNodeIds.map(() => '?').join(',')}) ORDER BY id ASC`,
    sourceNodeIds,
  ) as any[]
  const sourceExpenses = query(
    `SELECT * FROM expense_records WHERE node_id IN (${sourceNodeIds.map(() => '?').join(',')}) ORDER BY id ASC`,
    sourceNodeIds,
  ) as any[]
  const sourceMemos = query(
    `SELECT * FROM memos WHERE node_id IN (${sourceNodeIds.map(() => '?').join(',')}) ORDER BY id ASC`,
    sourceNodeIds,
  ) as any[]
  const sourceAttachments = query(
    `SELECT * FROM attachments WHERE node_id IN (${sourceNodeIds.map(() => '?').join(',')}) ORDER BY id ASC`,
    sourceNodeIds,
  ) as any[]

  const sourceUserIds = Array.from(new Set([
    ...sourceTodos.map((todo) => todo.user_id).filter(Boolean),
    ...sourceExpenses.map((expense) => expense.user_id).filter(Boolean),
    ...sourceMemos.map((memo) => memo.user_id).filter(Boolean),
    ...sourceAttachments.map((attachment) => attachment.user_id).filter(Boolean),
    ...sourceTodos.map((todo) => todo.assignee_id).filter(Boolean),
  ]))

  const sharedMemberIds = [sourceOwnerId, targetUserId]
  const allowedUserIds = new Set(sharedMemberIds)
  const sharedUsers = getUsersByIds(sourceUserIds)
  for (const user of sharedUsers) {
    if ((user.data_owner_id ?? user.id) === sourceOwnerId) {
      allowedUserIds.add(user.id)
    }
  }

  const nodeIdMap = new Map<number, number>()
  for (const node of sourceNodes) {
    const result = await run(
      `INSERT INTO timeline_nodes (user_id, name, description, status, "order", deadline, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetUserId,
        node.name,
        node.description ?? null,
        node.status,
        node.order,
        node.deadline ?? null,
        node.created_at,
        node.updated_at,
      ],
    )
    nodeIdMap.set(node.id, result.lastInsertRowid)
  }

  const todoIdMap = new Map<number, number>()
  for (const todo of sourceTodos) {
    const result = await run(
      `INSERT INTO todo_items (node_id, user_id, content, status, assignee_id, deadline, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nodeIdMap.get(todo.node_id),
        allowedUserIds.has(todo.user_id) ? todo.user_id : targetUserId,
        todo.content,
        todo.status,
        todo.assignee_id && allowedUserIds.has(todo.assignee_id) ? todo.assignee_id : null,
        todo.deadline ?? null,
        todo.created_at,
        todo.updated_at,
      ],
    )
    todoIdMap.set(todo.id, result.lastInsertRowid)
  }

  for (const expense of sourceExpenses) {
    await run(
      `INSERT INTO expense_records (node_id, todo_id, user_id, type, amount, category, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nodeIdMap.get(expense.node_id),
        expense.todo_id ? todoIdMap.get(expense.todo_id) ?? null : null,
        allowedUserIds.has(expense.user_id) ? expense.user_id : targetUserId,
        expense.type,
        expense.amount,
        expense.category,
        expense.description ?? null,
        expense.created_at,
        expense.updated_at,
      ],
    )
  }

  for (const memo of sourceMemos) {
    await run(
      `INSERT INTO memos (node_id, user_id, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        nodeIdMap.get(memo.node_id),
        allowedUserIds.has(memo.user_id) ? memo.user_id : targetUserId,
        memo.content,
        memo.created_at,
        memo.updated_at,
      ],
    )
  }

  for (const attachment of sourceAttachments) {
    await run(
      `INSERT INTO attachments (node_id, todo_id, user_id, file_name, file_path, file_size, file_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nodeIdMap.get(attachment.node_id),
        attachment.todo_id ? todoIdMap.get(attachment.todo_id) ?? null : null,
        allowedUserIds.has(attachment.user_id) ? attachment.user_id : targetUserId,
        attachment.file_name,
        attachment.file_path,
        attachment.file_size,
        attachment.file_type,
        attachment.created_at,
      ],
    )
  }
}
