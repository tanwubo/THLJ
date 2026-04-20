import { Request, Response } from 'express';
import { query, run } from '../db';

export const getTodos = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { nodeId } = req.query;

    if (!nodeId) {
      return res.status(400).json({ error: 'nodeId is required' });
    }

    // 验证节点归属
    const node = query('SELECT * FROM timeline_nodes WHERE id = ? AND user_id = ?', [nodeId, userId]);
    if (node.length === 0) {
      return res.status(404).json({ error: '节点不存在' });
    }

    const todos = query(
      `SELECT t.*, u.username as assignee_name
       FROM todo_items t
       LEFT JOIN users u ON t.assignee_id = u.id
       WHERE t.node_id = ?
       ORDER BY t.created_at DESC`,
      [nodeId]
    );

    res.json(todos);
  } catch (error: any) {
    console.error('获取待办失败:', error);
    res.status(500).json({ error: '获取待办失败' });
  }
};

export const createTodo = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { nodeId, content, assigneeId, deadline } = req.body;

    if (!nodeId || !content) {
      return res.status(400).json({ error: 'nodeId and content are required' });
    }

    // 验证节点归属
    const node = query('SELECT * FROM timeline_nodes WHERE id = ? AND user_id = ?', [nodeId, userId]);
    if (node.length === 0) {
      return res.status(404).json({ error: '节点不存在' });
    }

    const result = await run(
      'INSERT INTO todo_items (node_id, user_id, content, assignee_id, deadline, status) VALUES (?, ?, ?, ?, ?, ?)',
      [nodeId, userId, content.trim(), assigneeId || null, deadline || null, 'pending']
    );

    const todo = query('SELECT * FROM todo_items WHERE id = ?', [result.lastInsertRowid]);
    res.json(todo[0]);
  } catch (error: any) {
    console.error('创建待办失败:', error);
    res.status(500).json({ error: '创建待办失败' });
  }
};

export const updateTodo = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { content, assigneeId, deadline, status } = req.body;

    const todo = query('SELECT * FROM todo_items t JOIN timeline_nodes n ON t.node_id = n.id WHERE t.id = ? AND n.user_id = ?', [id, userId]);
    if (todo.length === 0) {
      return res.status(404).json({ error: '待办不存在' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (content !== undefined) { updates.push('content = ?'); values.push(content.trim()); }
    if (assigneeId !== undefined) { updates.push('assignee_id = ?'); values.push(assigneeId); }
    if (deadline !== undefined) { updates.push('deadline = ?'); values.push(deadline); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      await run(`UPDATE todo_items SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    const updated = query('SELECT * FROM todo_items WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (error: any) {
    console.error('更新待办失败:', error);
    res.status(500).json({ error: '更新待办失败' });
  }
};

export const deleteTodo = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const todo = query('SELECT * FROM todo_items t JOIN timeline_nodes n ON t.node_id = n.id WHERE t.id = ? AND n.user_id = ?', [id, userId]);
    if (todo.length === 0) {
      return res.status(404).json({ error: '待办不存在' });
    }

    await run('DELETE FROM todo_items WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error: any) {
    console.error('删除待办失败:', error);
    res.status(500).json({ error: '删除待办失败' });
  }
};

export const updateTodoStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { status } = req.body;

    const todo = query('SELECT * FROM todo_items t JOIN timeline_nodes n ON t.node_id = n.id WHERE t.id = ? AND n.user_id = ?', [id, userId]);
    if (todo.length === 0) {
      return res.status(404).json({ error: '待办不存在' });
    }

    await run('UPDATE todo_items SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);

    const updated = query('SELECT * FROM todo_items WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (error: any) {
    console.error('更新待办状态失败:', error);
    res.status(500).json({ error: '更新待办状态失败' });
  }
};
