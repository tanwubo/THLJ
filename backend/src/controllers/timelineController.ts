import { Request, Response } from 'express';
import { query, run } from '../db';
import { AuthRequest } from '../middleware/auth';

// 9个标准婚嫁节点
const DEFAULT_NODES = [
  { name: '确定结婚意向', order: 1 },
  { name: '双方父母见面', order: 2 },
  { name: '男方上门提亲', order: 3 },
  { name: '彩礼嫁妆三金协商', order: 4 },
  { name: '订婚仪式', order: 5 },
  { name: '婚前筹备', order: 6 },
  { name: '民政局领证', order: 7 },
  { name: '婚礼举办', order: 8 },
  { name: '婚后费用结算收尾', order: 9 },
];

// 获取用户时间线
export const getTimeline = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    // 检查用户是否有节点
    let nodes = query('SELECT * FROM timeline_nodes WHERE user_id = ? ORDER BY "order" ASC', [userId]);

    // 首次登录，自动创建9个标准节点
    if (nodes.length === 0) {
      for (const node of DEFAULT_NODES) {
        await run(
          'INSERT INTO timeline_nodes (user_id, name, "order", status) VALUES (?, ?, ?, ?)',
          [userId, node.name, node.order, 'pending']
        );
      }
      nodes = query('SELECT * FROM timeline_nodes WHERE user_id = ? ORDER BY "order" ASC', [userId]);
    }

    // 计算每个节点的进度（基于待办完成情况）
    const nodesWithProgress = nodes.map((node: any) => {
      const todos = query('SELECT * FROM todo_items WHERE node_id = ?', [node.id]);
      const completed = todos.filter((t: any) => t.status === 'completed').length;
      const progress = todos.length > 0 ? Math.round((completed / todos.length) * 100) : 0;
      return { ...node, progress, todos };
    });

    // 计算整体进度
    const totalProgress = nodesWithProgress.reduce((sum: number, n: any) => sum + (n.progress || 0), 0);
    const overallProgress = nodes.length > 0 ? Math.round(totalProgress / nodes.length) : 0;

    res.json({ nodes: nodesWithProgress, overallProgress });
  } catch (error: any) {
    console.error('获取时间线失败:', error);
    res.status(500).json({ error: '获取时间线失败' });
  }
};

// 创建节点
export const createNode = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, description, deadline } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: '节点名称不能为空' });
    }

    // 获取当前最大 order
    const maxOrder = query('SELECT MAX("order") as max FROM timeline_nodes WHERE user_id = ?', [userId]);
    const newOrder = (maxOrder[0]?.max || 0) + 1;

    const result = await run(
      'INSERT INTO timeline_nodes (user_id, name, description, deadline, "order", status) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, name.trim(), description || null, deadline || null, newOrder, 'pending']
    );

    const node = query('SELECT * FROM timeline_nodes WHERE id = ?', [result.lastInsertRowid]);
    res.json(node[0]);
  } catch (error: any) {
    console.error('创建节点失败:', error);
    res.status(500).json({ error: '创建节点失败' });
  }
};

// 更新节点
export const updateNode = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { name, description, deadline, status } = req.body;

    // 验证节点归属
    const node = query('SELECT * FROM timeline_nodes WHERE id = ? AND user_id = ?', [id, userId]);
    if (node.length === 0) {
      return res.status(404).json({ error: '节点不存在' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name.trim()); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (deadline !== undefined) { updates.push('deadline = ?'); values.push(deadline); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id, userId);
      await run(`UPDATE timeline_nodes SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values);
    }

    const updated = query('SELECT * FROM timeline_nodes WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (error: any) {
    console.error('更新节点失败:', error);
    res.status(500).json({ error: '更新节点失败' });
  }
};

// 删除节点（级联删除关联数据）
export const deleteNode = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    // 验证节点归属
    const node = query('SELECT * FROM timeline_nodes WHERE id = ? AND user_id = ?', [id, userId]);
    if (node.length === 0) {
      return res.status(404).json({ error: '节点不存在' });
    }

    // 级联删除关联数据
    await run('DELETE FROM todo_items WHERE node_id = ?', [id]);
    await run('DELETE FROM expense_records WHERE node_id = ?', [id]);
    await run('DELETE FROM memos WHERE node_id = ?', [id]);
    await run('DELETE FROM attachments WHERE node_id = ?', [id]);
    await run('DELETE FROM timeline_nodes WHERE id = ? AND user_id = ?', [id, userId]);

    res.json({ success: true });
  } catch (error: any) {
    console.error('删除节点失败:', error);
    res.status(500).json({ error: '删除节点失败' });
  }
};

// 更新节点顺序
export const updateNodeOrder = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { nodes } = req.body; // [{id, order}]

    for (const item of nodes) {
      await run('UPDATE timeline_nodes SET "order" = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
        [item.order, item.id, userId]);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('更新顺序失败:', error);
    res.status(500).json({ error: '更新顺序失败' });
  }
};

export const getNodeWorkbench = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const nodes = query('SELECT * FROM timeline_nodes WHERE id = ? AND user_id = ?', [id, userId]);
    if (nodes.length === 0) {
      return res.status(404).json({ error: '节点不存在' });
    }

    const todos = query('SELECT * FROM todo_items WHERE node_id = ? ORDER BY created_at DESC', [id]);
    const todoIds = todos.map((todo: any) => todo.id);

    const expenses = todoIds.length
      ? query(`SELECT * FROM expense_records WHERE todo_id IN (${todoIds.map(() => '?').join(',')})`, todoIds)
      : [];
    const attachments = todoIds.length
      ? query(`SELECT * FROM attachments WHERE todo_id IN (${todoIds.map(() => '?').join(',')})`, todoIds)
      : [];
    const memo = query('SELECT * FROM memos WHERE node_id = ? ORDER BY updated_at DESC LIMIT 1', [id])[0] || null;

    const groupedTodos = todos.map((todo: any) => ({
      ...todo,
      expenses: expenses.filter((expense: any) => expense.todo_id === todo.id),
      attachments: attachments.filter((attachment: any) => attachment.todo_id === todo.id),
    }));

    res.json({ node: nodes[0], todos: groupedTodos, memo });
  } catch (error: any) {
    console.error('获取工作台失败:', error);
    res.status(500).json({ error: '获取工作台失败' });
  }
};
