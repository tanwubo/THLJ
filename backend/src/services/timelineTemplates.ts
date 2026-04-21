import { query, run, runInTransaction } from '../db'

export const DEFAULT_TIMELINE_TEMPLATE = {
  name: '标准婚礼时间线',
  description: '覆盖婚礼筹备常见阶段，适合作为首次初始化模板。',
  nodes: [
    { name: '确定结婚意向', description: '' },
    { name: '双方父母见面', description: '' },
    { name: '男方上门提亲', description: '' },
    { name: '彩礼嫁妆三金协商', description: '' },
    { name: '订婚仪式', description: '' },
    { name: '婚前筹备', description: '' },
    { name: '民政局领证', description: '' },
    { name: '婚礼举办', description: '' },
    { name: '婚后费用结算收尾', description: '' },
  ],
}

export async function ensureDefaultTimelineTemplateSeeded() {
  const rows = query('SELECT id FROM timeline_templates LIMIT 1')
  if (rows.length > 0) {
    return
  }

  const templateResult = await run(
    'INSERT INTO timeline_templates (name, description, is_active) VALUES (?, ?, ?)',
    [DEFAULT_TIMELINE_TEMPLATE.name, DEFAULT_TIMELINE_TEMPLATE.description, 1],
  )

  await runInTransaction(
    DEFAULT_TIMELINE_TEMPLATE.nodes.map((node, index) => ({
      sql: 'INSERT INTO timeline_template_nodes (template_id, name, description, "order") VALUES (?, ?, ?, ?)',
      params: [templateResult.lastInsertRowid, node.name, node.description || null, index + 1],
    })),
  )
}

export function getTimelineTemplates(includeInactive = false) {
  const whereClause = includeInactive ? '' : 'WHERE t.is_active = 1'

  return query(
    `SELECT t.*, COUNT(n.id) as node_count
     FROM timeline_templates t
     LEFT JOIN timeline_template_nodes n ON n.template_id = t.id
     ${whereClause}
     GROUP BY t.id
     ORDER BY t.updated_at DESC`,
  )
}

export function getTimelineTemplateDetail(id: string | number) {
  const templates = query('SELECT * FROM timeline_templates WHERE id = ?', [id])
  if (templates.length === 0) {
    return null
  }

  const nodes = query(
    'SELECT * FROM timeline_template_nodes WHERE template_id = ? ORDER BY "order" ASC',
    [id],
  )

  return {
    ...templates[0],
    nodes,
  }
}
