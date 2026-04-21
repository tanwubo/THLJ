import { Response } from 'express'
import { run, runInTransaction, query } from '../db'
import { AuthRequest } from '../middleware/auth'
import { isAdminUsername } from '../services/admin'
import { getTimelineTemplateDetail, getTimelineTemplates } from '../services/timelineTemplates'

function ensureAdmin(req: AuthRequest, res: Response): boolean {
  if (!isAdminUsername(req.user?.username)) {
    res.status(403).json({ error: '无权限执行该操作' })
    return false
  }

  return true
}

export async function listTimelineTemplates(req: AuthRequest, res: Response) {
  const includeInactive = req.query.includeInactive === '1' && isAdminUsername(req.user?.username)
  res.json({ templates: getTimelineTemplates(includeInactive) })
}

export async function getTimelineTemplate(req: AuthRequest, res: Response) {
  const template = getTimelineTemplateDetail(req.params.id)
  if (!template || (!template.is_active && !isAdminUsername(req.user?.username))) {
    return res.status(404).json({ error: '模板不存在' })
  }

  res.json(template)
}

export async function createTimelineTemplate(req: AuthRequest, res: Response) {
  if (!ensureAdmin(req, res)) {
    return
  }

  const { name, description, isActive, nodes } = req.body

  if (!name?.trim()) {
    return res.status(400).json({ error: '模板名称不能为空' })
  }

  if (!Array.isArray(nodes) || nodes.length === 0) {
    return res.status(400).json({ error: '模板节点不能为空' })
  }

  const templateResult = await run(
    'INSERT INTO timeline_templates (name, description, is_active) VALUES (?, ?, ?)',
    [name.trim(), description?.trim() || null, isActive ? 1 : 0],
  )

  await runInTransaction(
    nodes.map((node: { name: string; description?: string }, index: number) => ({
      sql: 'INSERT INTO timeline_template_nodes (template_id, name, description, "order") VALUES (?, ?, ?, ?)',
      params: [templateResult.lastInsertRowid, node.name.trim(), node.description?.trim() || null, index + 1],
    })),
  )

  return res.json({ success: true, id: templateResult.lastInsertRowid })
}

export async function updateTimelineTemplate(req: AuthRequest, res: Response) {
  if (!ensureAdmin(req, res)) {
    return
  }

  const { id } = req.params
  const { name, description, isActive, nodes } = req.body

  if (!name?.trim()) {
    return res.status(400).json({ error: '模板名称不能为空' })
  }

  if (!Array.isArray(nodes) || nodes.length === 0) {
    return res.status(400).json({ error: '模板节点不能为空' })
  }

  const existing = query('SELECT * FROM timeline_templates WHERE id = ?', [id])
  if (existing.length === 0) {
    return res.status(404).json({ error: '模板不存在' })
  }

  await runInTransaction([
    {
      sql: 'UPDATE timeline_templates SET name = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      params: [name.trim(), description?.trim() || null, isActive ? 1 : 0, id],
    },
    {
      sql: 'DELETE FROM timeline_template_nodes WHERE template_id = ?',
      params: [id],
    },
    ...nodes.map((node: { name: string; description?: string }, index: number) => ({
      sql: 'INSERT INTO timeline_template_nodes (template_id, name, description, "order") VALUES (?, ?, ?, ?)',
      params: [id, node.name.trim(), node.description?.trim() || null, index + 1],
    })),
  ])

  res.json({ success: true })
}

export async function deleteTimelineTemplate(req: AuthRequest, res: Response) {
  if (!ensureAdmin(req, res)) {
    return
  }

  const { id } = req.params

  await runInTransaction([
    { sql: 'DELETE FROM timeline_template_nodes WHERE template_id = ?', params: [id] },
    { sql: 'DELETE FROM timeline_templates WHERE id = ?', params: [id] },
  ])

  res.json({ success: true })
}

export async function applyTimelineTemplate(req: AuthRequest, res: Response) {
  const dataOwnerId = req.user?.dataOwnerId ?? req.user?.id
  const { templateId } = req.body

  const template = getTimelineTemplateDetail(templateId)
  if (!template || !template.is_active) {
    return res.status(404).json({ error: '模板不存在或不可用' })
  }

  const existingNodes = query('SELECT id FROM timeline_nodes WHERE user_id = ? LIMIT 1', [dataOwnerId])
  if (existingNodes.length > 0) {
    return res.status(400).json({ error: '当前时间线已有数据，无法再次应用模板' })
  }

  await runInTransaction(
    template.nodes.map((node: any, index: number) => ({
      sql: 'INSERT INTO timeline_nodes (user_id, name, description, "order", status, deadline) VALUES (?, ?, ?, ?, ?, ?)',
      params: [dataOwnerId, node.name, node.description ?? null, index + 1, 'pending', null],
    })),
  )

  res.json({ success: true })
}
